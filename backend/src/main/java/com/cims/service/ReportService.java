package com.cims.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.evaluation.EvaluationDto;
import com.cims.dto.feedback.CompanyFeedbackDto;
import com.cims.dto.interview.InterviewDto;
import com.cims.dto.report.AdminReportDto;
import com.cims.dto.report.FacultyReportDto;
import com.cims.dto.report.ReportCommon.Offer;
import com.cims.dto.report.ReportCommon.PeriodCount;
import com.cims.dto.report.ReportCommon.StatusCount;
import com.cims.dto.report.StudentReportDto;
import com.cims.entity.Application;
import com.cims.entity.Student;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.CompanyStatus;
import com.cims.entity.enums.InterviewResult;
import com.cims.entity.enums.InterviewStatus;
import com.cims.entity.enums.Role;
import com.cims.repository.ApplicationRepository;
import com.cims.repository.ApplicationStatusHistoryRepository;
import com.cims.repository.AuditLogRepository;
import com.cims.repository.CompanyFeedbackRepository;
import com.cims.repository.CompanyRepository;
import com.cims.repository.EvaluationRepository;
import com.cims.repository.FacultyFeedbackRepository;
import com.cims.repository.InternshipRepository;
import com.cims.repository.InterviewRepository;
import com.cims.repository.ReportQueryRepository;
import com.cims.repository.StudentFeedbackRepository;
import com.cims.repository.StudentRepository;
import com.cims.repository.SystemFeedbackRepository;
import com.cims.repository.UserRepository;
import com.cims.repository.spec.ApplicationSpecifications;
import com.cims.repository.spec.InterviewSpecifications;

/**
 * Admin, faculty and student reports. All numbers are calculated from the database on each
 * request. Rates are percentages rounded to one decimal; a rate whose denominator is zero is
 * returned as null so the UI can show "No data available" instead of a misleading 0%.
 */
@Service
public class ReportService {

    private static final int TOP_N = 5;
    private static final int MONTHS = 6;
    private static final int DAYS = 30;
    private static final Map<AuditAction, String> VIOLATIONS = new LinkedHashMap<>();

    static {
        VIOLATIONS.put(AuditAction.ACCESS_DENIED, "Attempts to access a resource without permission");
        VIOLATIONS.put(AuditAction.LOGIN_FAILED, "Failed login attempts (wrong credentials or deactivated account)");
        VIOLATIONS.put(AuditAction.INVALID_FILE_UPLOAD, "Rejected uploads (non-PDF, invalid PDF or larger than 5 MB)");
        VIOLATIONS.put(AuditAction.DUPLICATE_APPLICATION_ATTEMPT, "Attempts to apply twice for the same internship");
    }

    private final ReportQueryRepository reports;
    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final CompanyRepository companyRepository;
    private final InternshipRepository internshipRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationStatusHistoryRepository historyRepository;
    private final InterviewRepository interviewRepository;
    private final EvaluationRepository evaluationRepository;
    private final StudentFeedbackRepository studentFeedbackRepository;
    private final CompanyFeedbackRepository companyFeedbackRepository;
    private final FacultyFeedbackRepository facultyFeedbackRepository;
    private final SystemFeedbackRepository systemFeedbackRepository;
    private final AuditLogRepository auditLogRepository;
    private final FileStorageService fileStorageService;
    private final EvaluationMapper evaluationMapper;
    private final CurrentUserService currentUserService;
    private final Clock clock;

    public ReportService(ReportQueryRepository reports, UserRepository userRepository, StudentRepository studentRepository,
                         CompanyRepository companyRepository, InternshipRepository internshipRepository,
                         ApplicationRepository applicationRepository, ApplicationStatusHistoryRepository historyRepository,
                         InterviewRepository interviewRepository, EvaluationRepository evaluationRepository,
                         StudentFeedbackRepository studentFeedbackRepository,
                         CompanyFeedbackRepository companyFeedbackRepository,
                         FacultyFeedbackRepository facultyFeedbackRepository,
                         SystemFeedbackRepository systemFeedbackRepository, AuditLogRepository auditLogRepository,
                         FileStorageService fileStorageService, EvaluationMapper evaluationMapper,
                         CurrentUserService currentUserService, Clock clock) {
        this.reports = reports;
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.companyRepository = companyRepository;
        this.internshipRepository = internshipRepository;
        this.applicationRepository = applicationRepository;
        this.historyRepository = historyRepository;
        this.interviewRepository = interviewRepository;
        this.evaluationRepository = evaluationRepository;
        this.studentFeedbackRepository = studentFeedbackRepository;
        this.companyFeedbackRepository = companyFeedbackRepository;
        this.facultyFeedbackRepository = facultyFeedbackRepository;
        this.systemFeedbackRepository = systemFeedbackRepository;
        this.auditLogRepository = auditLogRepository;
        this.fileStorageService = fileStorageService;
        this.evaluationMapper = evaluationMapper;
        this.currentUserService = currentUserService;
        this.clock = clock;
    }

    // ================================================================== admin

    @Transactional(readOnly = true)
    public AdminReportDto adminReport() {
        long totalStudents = userRepository.countByRole(Role.STUDENT);
        long activeStudents = userRepository.countByRoleAndActiveTrue(Role.STUDENT);
        long placed = reports.placedStudents();
        var placement = new AdminReportDto.PlacementSummary(totalStudents, activeStudents, placed,
                percentage(placed, activeStudents), reports.averageAcceptedStipend());

        Map<ApplicationStatus, Long> statusCounts = reports.applicationStatusCounts(null, null);
        long totalApplications = sum(statusCounts.values());
        long accepted = statusCounts.get(ApplicationStatus.ACCEPTED);
        var applications = new AdminReportDto.ApplicationAnalytics(totalApplications, accepted,
                percentage(accepted, totalApplications - statusCounts.get(ApplicationStatus.WITHDRAWN)),
                toStatusCounts(statusCounts), monthly(reports.applicationTimestampsSince(monthsAgo(MONTHS))));

        long completed = reports.completedApplications(null);
        var performance = new AdminReportDto.StudentPerformance(reports.topStudents(TOP_N), reports.popularInternships(TOP_N),
                accepted, completed, percentage(completed, accepted));

        var companies = new AdminReportDto.CompanyStatistics(companyRepository.count(),
                companyRepository.countByStatus(CompanyStatus.ACTIVE), reports.mostActiveCompanies(TOP_N),
                reports.companyRatings(10), reports.studentFeedbackAverages(null));

        Instant thirtyDaysAgo = Instant.now().minus(DAYS, ChronoUnit.DAYS);
        var activity = new AdminReportDto.SystemActivity(
                monthly(userRepository.findCreatedAtSince(monthsAgo(MONTHS))),
                daily(auditLogRepository.findTimestamps(AuditAction.LOGIN_SUCCESS, thirtyDaysAgo), DAYS),
                auditLogRepository.countByActionAndCreatedAtGreaterThanEqual(AuditAction.LOGIN_SUCCESS, thirtyDaysAgo),
                auditLogRepository.countByActionAndCreatedAtGreaterThanEqual(AuditAction.LOGIN_FAILED, thirtyDaysAgo),
                dataUsage());

        return new AdminReportDto(placement, applications, performance, companies, activity, compliance(thirtyDaysAgo));
    }

    private AdminReportDto.DataUsage dataUsage() {
        long feedbackEntries = studentFeedbackRepository.count() + companyFeedbackRepository.count()
                + facultyFeedbackRepository.count() + systemFeedbackRepository.count();
        return new AdminReportDto.DataUsage(userRepository.count(), studentRepository.count(),
                userRepository.countByRole(Role.FACULTY), companyRepository.count(), internshipRepository.count(),
                applicationRepository.count(), interviewRepository.count(), evaluationRepository.countByArchivedFalse(),
                feedbackEntries, studentRepository.countByResumePathIsNotNull(), fileStorageService.totalStoredBytes());
    }

    private AdminReportDto.Compliance compliance(Instant since) {
        List<AdminReportDto.ViolationCount> violations = VIOLATIONS.entrySet().stream()
                .map(e -> new AdminReportDto.ViolationCount(e.getKey().name(), e.getValue(),
                        auditLogRepository.countByActionAndCreatedAtGreaterThanEqual(e.getKey(), since),
                        auditLogRepository.countByAction(e.getKey())))
                .toList();
        long totalApplications = applicationRepository.count();
        var documents = new AdminReportDto.DocumentVerification(studentRepository.countByResumePathIsNotNull(),
                studentRepository.countByResumePathIsNull(), userRepository.countByVerifiedTrue(),
                userRepository.countByVerifiedFalse(), totalApplications, totalApplications);
        var recent = auditLogRepository.findByActionIn(VIOLATIONS.keySet(),
                        PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt"))).stream()
                .map(a -> new AdminReportDto.AuditEntry(a.getId(), a.getAction().name(),
                        a.getUser() != null ? a.getUser().getEmail() : null, a.getDetails(), a.getCreatedAt()))
                .toList();
        return new AdminReportDto.Compliance(violations, documents, recent);
    }

    // ================================================================== faculty

    @Transactional(readOnly = true)
    public FacultyReportDto facultyReport() {
        Long facultyId = currentUserService.faculty().getId();

        var internshipCounts = reports.internshipStatusCounts(facultyId);
        var posted = new FacultyReportDto.PostedInternships(sum(internshipCounts.values()),
                internshipCounts.entrySet().stream().map(e -> new StatusCount(e.getKey().name(), e.getValue())).toList(),
                reports.applicationsPerInternship(facultyId));

        Map<ApplicationStatus, Long> app = reports.applicationStatusCounts(facultyId, null);
        long total = sum(app.values());
        long shortlisted = app.get(ApplicationStatus.SHORTLISTED);
        long accepted = app.get(ApplicationStatus.ACCEPTED);
        long rejected = app.get(ApplicationStatus.REJECTED);
        long withdrawn = app.get(ApplicationStatus.WITHDRAWN);
        var review = new FacultyReportDto.ApplicationReview(total, shortlisted + accepted + rejected,
                app.get(ApplicationStatus.PENDING), shortlisted, accepted, rejected, withdrawn,
                percentage(shortlisted + accepted, total - withdrawn));

        var companyFeedback = reports.companyFeedbackAverages(facultyId);
        var evaluations = new FacultyReportDto.StudentEvaluations(reports.evaluatedStudents(facultyId),
                reports.evaluationAverages(facultyId), companyFeedback, companyFeedback.overall(),
                reports.studentFeedbackAverages(facultyId));

        Map<InterviewStatus, Long> interviews = reports.interviewStatusCounts(facultyId);
        long completedInterviews = interviews.get(InterviewStatus.COMPLETED);
        long selected = reports.interviewsWithResult(facultyId, InterviewResult.SELECTED);
        var interviewStats = new FacultyReportDto.InterviewStatistics(interviews.get(InterviewStatus.SCHEDULED),
                completedInterviews, interviews.get(InterviewStatus.CANCELLED), selected,
                percentage(selected, completedInterviews));

        return new FacultyReportDto(posted, review, evaluations, interviewStats);
    }

    // ================================================================== student

    @Transactional(readOnly = true)
    public StudentReportDto studentReport() {
        Student student = currentUserService.student();
        Long studentId = student.getId();

        Map<ApplicationStatus, Long> counts = reports.applicationStatusCounts(null, studentId);
        var filter = new ApplicationSpecifications.Filter(studentId, null, null, null, null, null);
        List<Application> applications = applicationRepository.findAll(ApplicationSpecifications.matching(filter),
                Sort.by(Sort.Direction.DESC, "appliedAt"));
        var timeline = applications.stream()
                .map(a -> new StudentReportDto.ApplicationTimelineItem(a.getId(), a.getInternship().getTitle(),
                        a.getInternship().getCompany().getName(), a.getStatus().name(), a.getAppliedAt(), a.getUpdatedAt()))
                .toList();
        var myApplications = new StudentReportDto.MyApplications(sum(counts.values()), toStatusCounts(counts), timeline);

        LocalDate today = LocalDate.now(clock);
        var upcoming = interviewRepository.findAll(InterviewSpecifications.matching(new InterviewSpecifications.Filter(
                        studentId, null, null, null, "upcoming", today, null)),
                Sort.by("interviewDate", "interviewTime")).stream().map(InterviewDto::from).toList();
        var past = interviewRepository.findAll(InterviewSpecifications.matching(new InterviewSpecifications.Filter(
                        studentId, null, null, null, "past", today, null)),
                Sort.by(Sort.Direction.DESC, "interviewDate", "interviewTime")).stream().map(InterviewDto::from).toList();

        List<Offer> offers = applications.stream()
                .filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .map(a -> new Offer(a.getId(), a.getInternship().getId(), a.getInternship().getTitle(),
                        a.getInternship().getCompany().getName(), a.getInternship().getCompany().getLocation(),
                        a.getInternship().getStipend(), a.getInternship().getStartDate(), a.getInternship().getEndDate(),
                        a.getInternship().getDurationWeeks(), acceptedAt(a), a.getCompletedAt()))
                .toList();
        var placement = new StudentReportDto.PlacementStatus(offers.isEmpty() ? "NOT_PLACED" : "PLACED", offers);

        List<EvaluationDto> evaluations = evaluationMapper.toDtos(evaluationRepository
                .search(studentId, null, null, false, null, PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent());
        List<CompanyFeedbackDto> companyFeedback = companyFeedbackRepository
                .search(studentId, null, null, PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(CompanyFeedbackDto::from).getContent();

        return new StudentReportDto(myApplications, new StudentReportDto.InterviewSchedule(upcoming, past), placement,
                evaluations, companyFeedback);
    }

    private Instant acceptedAt(Application application) {
        return historyRepository.findByApplicationIdOrderByChangedAtAscIdAsc(application.getId()).stream()
                .filter(h -> h.getNewStatus() == ApplicationStatus.ACCEPTED)
                .map(h -> h.getChangedAt())
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    // ================================================================== helpers (package-visible for dashboards)

    List<StatusCount> toStatusCounts(Map<ApplicationStatus, Long> counts) {
        return counts.entrySet().stream().map(e -> new StatusCount(e.getKey().name(), e.getValue())).toList();
    }

    Instant monthsAgo(int months) {
        ZoneId zone = clock.getZone();
        return YearMonth.now(clock).minusMonths(months - 1L).atDay(1).atStartOfDay(zone).toInstant();
    }

    /** Buckets timestamps by month (college time zone), including empty months. */
    List<PeriodCount> monthly(Collection<Instant> timestamps) {
        ZoneId zone = clock.getZone();
        Map<String, Long> buckets = new LinkedHashMap<>();
        YearMonth current = YearMonth.now(clock);
        for (int i = MONTHS - 1; i >= 0; i--) {
            buckets.put(current.minusMonths(i).toString(), 0L);
        }
        for (Instant t : timestamps) {
            buckets.computeIfPresent(YearMonth.from(t.atZone(zone)).toString(), (k, v) -> v + 1);
        }
        List<PeriodCount> result = new ArrayList<>();
        buckets.forEach((k, v) -> result.add(new PeriodCount(k, v)));
        return result;
    }

    /** Buckets timestamps by day (college time zone) for the last {@code days} days. */
    List<PeriodCount> daily(Collection<Instant> timestamps, int days) {
        ZoneId zone = clock.getZone();
        Map<String, Long> buckets = new LinkedHashMap<>();
        LocalDate today = LocalDate.now(clock);
        for (int i = days - 1; i >= 0; i--) {
            buckets.put(today.minusDays(i).toString(), 0L);
        }
        for (Instant t : timestamps) {
            buckets.computeIfPresent(t.atZone(zone).toLocalDate().toString(), (k, v) -> v + 1);
        }
        List<PeriodCount> result = new ArrayList<>();
        buckets.forEach((k, v) -> result.add(new PeriodCount(k, v)));
        return result;
    }

    static Double percentage(long numerator, long denominator) {
        if (denominator <= 0) {
            return null;
        }
        return Math.round(numerator * 1000.0 / denominator) / 10.0;
    }

    static long sum(Collection<Long> values) {
        return values.stream().mapToLong(Long::longValue).sum();
    }
}
