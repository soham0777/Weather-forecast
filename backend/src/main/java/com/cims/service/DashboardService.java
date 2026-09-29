package com.cims.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.application.ApplicationDto;
import com.cims.dto.dashboard.AdminDashboardDto;
import com.cims.dto.dashboard.FacultyDashboardDto;
import com.cims.dto.dashboard.StudentDashboardDto;
import com.cims.dto.internship.InternshipDto;
import com.cims.dto.interview.InterviewDto;
import com.cims.dto.report.ReportCommon.StatusCount;
import com.cims.entity.Student;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.CompanyStatus;
import com.cims.entity.enums.InternshipStatus;
import com.cims.entity.enums.InterviewStatus;
import com.cims.entity.enums.Role;
import com.cims.repository.ApplicationRepository;
import com.cims.repository.CompanyRepository;
import com.cims.repository.EvaluationRepository;
import com.cims.repository.InternshipRepository;
import com.cims.repository.InterviewRepository;
import com.cims.repository.ReportQueryRepository;
import com.cims.repository.UserRepository;
import com.cims.repository.spec.ApplicationSpecifications;
import com.cims.repository.spec.InternshipSpecifications;
import com.cims.repository.spec.InterviewSpecifications;

/** Role dashboards: headline counts plus short "what needs attention" lists, all from live data. */
@Service
public class DashboardService {

    private final ReportQueryRepository reports;
    private final ReportService reportService;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final InternshipRepository internshipRepository;
    private final ApplicationRepository applicationRepository;
    private final InterviewRepository interviewRepository;
    private final EvaluationRepository evaluationRepository;
    private final InternshipService internshipService;
    private final EvaluationService evaluationService;
    private final CurrentUserService currentUserService;
    private final Clock clock;

    public DashboardService(ReportQueryRepository reports, ReportService reportService, UserRepository userRepository,
                            CompanyRepository companyRepository, InternshipRepository internshipRepository,
                            ApplicationRepository applicationRepository, InterviewRepository interviewRepository,
                            EvaluationRepository evaluationRepository, InternshipService internshipService,
                            EvaluationService evaluationService, CurrentUserService currentUserService, Clock clock) {
        this.reports = reports;
        this.reportService = reportService;
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.internshipRepository = internshipRepository;
        this.applicationRepository = applicationRepository;
        this.interviewRepository = interviewRepository;
        this.evaluationRepository = evaluationRepository;
        this.internshipService = internshipService;
        this.evaluationService = evaluationService;
        this.currentUserService = currentUserService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AdminDashboardDto admin() {
        Map<ApplicationStatus, Long> applications = reports.applicationStatusCounts(null, null);
        Map<InternshipStatus, Long> internships = reports.internshipStatusCounts(null);
        List<InternshipDto> awaiting = internshipRepository.findAll(
                        InternshipSpecifications.matching(new InternshipSpecifications.Filter(null, null, null, null, null,
                                null, List.of(InternshipStatus.PENDING), null)),
                        PageRequest.of(0, 5, Sort.by(Sort.Direction.ASC, "createdAt")))
                .map(i -> internshipService.get(i.getId())).getContent();
        return new AdminDashboardDto(
                userRepository.countByRole(Role.STUDENT),
                userRepository.countByRoleAndActiveTrue(Role.STUDENT),
                userRepository.countByRole(Role.FACULTY),
                companyRepository.countByStatus(CompanyStatus.ACTIVE),
                internshipRepository.count(),
                internships.get(InternshipStatus.PENDING),
                ReportService.sum(applications.values()),
                applications.get(ApplicationStatus.PENDING),
                reports.upcomingInterviews(null, null, LocalDate.now(clock)),
                interviewRepository.count(),
                applications.get(ApplicationStatus.ACCEPTED),
                reportService.toStatusCounts(applications),
                internships.entrySet().stream().map(e -> new StatusCount(e.getKey().name(), e.getValue())).toList(),
                reportService.monthly(reports.applicationTimestampsSince(reportService.monthsAgo(6))),
                awaiting);
    }

    @Transactional(readOnly = true)
    public FacultyDashboardDto faculty() {
        Long facultyId = currentUserService.faculty().getId();
        Map<ApplicationStatus, Long> applications = reports.applicationStatusCounts(facultyId, null);
        Map<InternshipStatus, Long> internships = reports.internshipStatusCounts(facultyId);
        LocalDate today = LocalDate.now(clock);

        List<InterviewDto> upcoming = interviewRepository.findAll(
                        InterviewSpecifications.matching(new InterviewSpecifications.Filter(null, facultyId, null,
                                InterviewStatus.SCHEDULED, "upcoming", today, null)),
                        PageRequest.of(0, 5, Sort.by("interviewDate", "interviewTime")))
                .map(InterviewDto::from).getContent();
        List<ApplicationDto> recent = applicationRepository.findAll(
                        ApplicationSpecifications.matching(new ApplicationSpecifications.Filter(null, facultyId, null, null,
                                null, null)),
                        PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "appliedAt")))
                .map(ApplicationDto::from).getContent();
        long evaluations = evaluationRepository.search(null, facultyId, null, false, null, PageRequest.of(0, 1))
                .getTotalElements();

        return new FacultyDashboardDto(
                ReportService.sum(internships.values()),
                internships.get(InternshipStatus.PENDING),
                internships.get(InternshipStatus.OPEN),
                ReportService.sum(applications.values()),
                applications.get(ApplicationStatus.PENDING),
                applications.get(ApplicationStatus.SHORTLISTED),
                reports.upcomingInterviews(facultyId, null, today),
                evaluations,
                evaluationService.pending().size(),
                reportService.toStatusCounts(applications),
                upcoming,
                recent);
    }

    @Transactional(readOnly = true)
    public StudentDashboardDto student() {
        Student student = currentUserService.student();
        Long studentId = student.getId();
        Map<ApplicationStatus, Long> applications = reports.applicationStatusCounts(null, studentId);
        LocalDate today = LocalDate.now(clock);

        long available = internshipRepository.count(InternshipSpecifications.matching(new InternshipSpecifications.Filter(
                null, null, null, null, null, null, List.of(InternshipStatus.OPEN), null)).and(
                (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("applicationDeadline"), today)));
        List<InterviewDto> upcoming = interviewRepository.findAll(
                        InterviewSpecifications.matching(new InterviewSpecifications.Filter(studentId, null, null,
                                InterviewStatus.SCHEDULED, "upcoming", today, null)),
                        PageRequest.of(0, 5, Sort.by("interviewDate", "interviewTime")))
                .map(InterviewDto::from).getContent();
        List<ApplicationDto> recent = applicationRepository.findAll(
                        ApplicationSpecifications.matching(new ApplicationSpecifications.Filter(studentId, null, null, null,
                                null, null)),
                        PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "updatedAt")))
                .map(ApplicationDto::from).getContent();

        return new StudentDashboardDto(
                StudentService.profileCompletion(student),
                student.getResumePath() != null,
                student.getUser().isVerified(),
                available,
                ReportService.sum(applications.values()),
                applications.get(ApplicationStatus.PENDING),
                applications.get(ApplicationStatus.SHORTLISTED),
                applications.get(ApplicationStatus.ACCEPTED),
                reports.upcomingInterviews(null, studentId, today),
                upcoming,
                recent);
    }
}
