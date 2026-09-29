package com.cims.service;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.application.ApplicationDetailDto;
import com.cims.dto.application.ApplicationDto;
import com.cims.dto.application.ApplicationRequest;
import com.cims.dto.application.ApplicationStatusRequest;
import com.cims.dto.application.ApplicationUpdateRequest;
import com.cims.dto.application.TimelineEventDto;
import com.cims.dto.common.PageResponse;
import com.cims.dto.feedback.CompanyFeedbackDto;
import com.cims.dto.feedback.StudentFeedbackDto;
import com.cims.dto.interview.InterviewDto;
import com.cims.entity.Application;
import com.cims.entity.ApplicationStatusHistory;
import com.cims.entity.Internship;
import com.cims.entity.Interview;
import com.cims.entity.Student;
import com.cims.entity.User;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.InterviewStatus;
import com.cims.entity.enums.Role;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ConflictException;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.ApplicationRepository;
import com.cims.repository.ApplicationStatusHistoryRepository;
import com.cims.repository.CompanyFeedbackRepository;
import com.cims.repository.EvaluationRepository;
import com.cims.repository.InternshipRepository;
import com.cims.repository.InterviewRepository;
import com.cims.repository.StudentFeedbackRepository;
import com.cims.repository.spec.ApplicationSpecifications;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;
import com.cims.util.TransactionUtils;

/**
 * Application workflow.
 *
 * <pre>
 * PENDING ──► SHORTLISTED ──► ACCEPTED
 *    │             │
 *    └──► REJECTED ◄┘          (faculty coordinator / admin)
 * PENDING | SHORTLISTED ──► WITHDRAWN (student)
 * </pre>
 * Every status change is written to application_status_history, which drives the timeline.
 */
@Service
public class ApplicationService {

    /** Allowed reviewer transitions. */
    private static final Map<ApplicationStatus, Set<ApplicationStatus>> REVIEW_TRANSITIONS = Map.of(
            ApplicationStatus.PENDING, EnumSet.of(ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED),
            ApplicationStatus.SHORTLISTED, EnumSet.of(ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED));
    private static final Set<ApplicationStatus> WITHDRAWABLE = EnumSet.of(ApplicationStatus.PENDING, ApplicationStatus.SHORTLISTED);

    private static final Map<String, String> SORT_KEYS = Map.of(
            "appliedAt", "appliedAt", "updatedAt", "updatedAt", "status", "status");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("hh:mm a");

    private final ApplicationRepository applicationRepository;
    private final ApplicationStatusHistoryRepository historyRepository;
    private final InternshipRepository internshipRepository;
    private final InterviewRepository interviewRepository;
    private final EvaluationRepository evaluationRepository;
    private final StudentFeedbackRepository studentFeedbackRepository;
    private final CompanyFeedbackRepository companyFeedbackRepository;
    private final ApplicationAccessService access;
    private final InternshipService internshipService;
    private final FileStorageService fileStorageService;
    private final EvaluationMapper evaluationMapper;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    public ApplicationService(ApplicationRepository applicationRepository, ApplicationStatusHistoryRepository historyRepository,
                              InternshipRepository internshipRepository, InterviewRepository interviewRepository,
                              EvaluationRepository evaluationRepository, StudentFeedbackRepository studentFeedbackRepository,
                              CompanyFeedbackRepository companyFeedbackRepository, ApplicationAccessService access,
                              InternshipService internshipService, FileStorageService fileStorageService,
                              EvaluationMapper evaluationMapper, CurrentUserService currentUserService,
                              AuditService auditService) {
        this.applicationRepository = applicationRepository;
        this.historyRepository = historyRepository;
        this.internshipRepository = internshipRepository;
        this.interviewRepository = interviewRepository;
        this.evaluationRepository = evaluationRepository;
        this.studentFeedbackRepository = studentFeedbackRepository;
        this.companyFeedbackRepository = companyFeedbackRepository;
        this.access = access;
        this.internshipService = internshipService;
        this.fileStorageService = fileStorageService;
        this.evaluationMapper = evaluationMapper;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
    }

    // ------------------------------------------------------------------ queries

    public record SearchParams(ApplicationStatus status, Long internshipId, Long companyId, String q, Integer page,
                               Integer size, String sort) {
    }

    /** Students see their own applications, faculty those for their internships, admins all. */
    @Transactional(readOnly = true)
    public PageResponse<ApplicationDto> search(SearchParams params) {
        UserPrincipal principal = currentUserService.principal();
        Long studentId = principal.isStudent() ? currentUserService.student().getId() : null;
        Long facultyId = principal.isFaculty() ? currentUserService.faculty().getId() : null;
        var filter = new ApplicationSpecifications.Filter(studentId, facultyId, params.internshipId(), params.companyId(),
                params.status(), TextUtils.likePattern(params.q()));
        var pageable = PageUtils.of(params.page(), params.size(), params.sort(), SORT_KEYS,
                Sort.by(Sort.Direction.DESC, "appliedAt"));
        return PageResponse.of(applicationRepository.findAll(ApplicationSpecifications.matching(filter), pageable),
                ApplicationDto::from);
    }

    /**
     * Full application details. The first time the internship's coordinator (or an admin)
     * opens a pending application, the review start is recorded ("Under review" in the timeline).
     */
    @Transactional
    public ApplicationDetailDto get(Long id) {
        Application application = access.loadForView(id);
        UserPrincipal principal = currentUserService.principal();
        if (access.canManage(application, principal) && application.getReviewedAt() == null
                && application.getStatus() == ApplicationStatus.PENDING) {
            application.setReviewedAt(Instant.now());
        }
        return toDetail(application, principal);
    }

    // ------------------------------------------------------------------ student commands

    @Transactional
    public ApplicationDetailDto apply(ApplicationRequest request) {
        Student student = currentUserService.student();
        if (!student.getUser().isActive()) {
            throw new ForbiddenException("Your account is inactive and cannot submit applications.");
        }
        Internship internship = internshipRepository.findDetailedById(request.internshipId())
                .orElseThrow(() -> NotFoundException.of("Internship", request.internshipId()));
        if (applicationRepository.existsByStudentIdAndInternshipId(student.getId(), internship.getId())) {
            auditService.logViolation(AuditAction.DUPLICATE_APPLICATION_ATTEMPT, "Internship", internship.getId(),
                    "Student " + student.getId() + " tried to apply again");
            throw new ConflictException("You have already applied for this internship.");
        }
        if (!internshipService.isAcceptingApplications(internship)) {
            throw new ConflictException("This internship is not accepting applications (it is not open or the deadline has passed).");
        }
        if (student.getResumePath() == null) {
            throw BusinessValidationException.forField("resume", "Please upload your resume (PDF) on your profile before applying.");
        }

        String snapshot = fileStorageService.copyToApplicationSnapshot(student.getResumePath());
        TransactionUtils.onRollback(() -> fileStorageService.deleteQuietly(snapshot));

        Application application = new Application();
        application.setStudent(student);
        application.setInternship(internship);
        application.setResumePath(snapshot);
        application.setCoverLetter(request.coverLetter().trim());
        application.setQualifications(TextUtils.trimToNull(request.qualifications()));
        application.setStatus(ApplicationStatus.PENDING);
        applicationRepository.saveAndFlush(application);
        recordHistory(application, null, ApplicationStatus.PENDING, "Application submitted");
        return toDetail(application, currentUserService.principal());
    }

    @Transactional
    public ApplicationDetailDto update(Long id, ApplicationUpdateRequest request) {
        Application application = access.loadForView(id);
        UserPrincipal principal = currentUserService.principal();
        if (!access.isApplicant(application, principal)) {
            throw new ForbiddenException("Only the applicant can edit this application.");
        }
        if (application.getStatus() != ApplicationStatus.PENDING
                || !internshipService.isAcceptingApplications(application.getInternship())) {
            throw new ConflictException("Only pending applications can be edited, and only before the deadline.");
        }
        application.setCoverLetter(request.coverLetter().trim());
        application.setQualifications(TextUtils.trimToNull(request.qualifications()));
        return toDetail(application, principal);
    }

    /** "Delete" for students: the application is kept and marked WITHDRAWN. */
    @Transactional
    public ApplicationDetailDto withdraw(Long id) {
        Application application = access.loadForView(id);
        UserPrincipal principal = currentUserService.principal();
        if (!access.isApplicant(application, principal)) {
            throw new ForbiddenException("Only the applicant can withdraw this application.");
        }
        if (!WITHDRAWABLE.contains(application.getStatus())) {
            throw new ConflictException("Only pending or shortlisted applications can be withdrawn (current status: "
                    + application.getStatus() + ").");
        }
        ApplicationStatus old = application.getStatus();
        application.setStatus(ApplicationStatus.WITHDRAWN);
        recordHistory(application, old, ApplicationStatus.WITHDRAWN, "Withdrawn by student");
        cancelScheduledInterviews(application, "Cancelled automatically because the application was withdrawn.");
        return toDetail(application, principal);
    }

    // ------------------------------------------------------------------ reviewer commands

    @Transactional
    public ApplicationDetailDto changeStatus(Long id, ApplicationStatusRequest request) {
        Application application = access.loadForManage(id);
        ApplicationStatus from = application.getStatus();
        ApplicationStatus to = request.status();
        if (!REVIEW_TRANSITIONS.getOrDefault(from, Set.of()).contains(to)) {
            throw new ConflictException("Cannot change an application from " + from + " to " + to + ". "
                    + "Allowed: PENDING → SHORTLISTED/REJECTED, SHORTLISTED → ACCEPTED/REJECTED.");
        }
        if (application.getReviewedAt() == null) {
            application.setReviewedAt(Instant.now());
        }
        application.setStatus(to);
        recordHistory(application, from, to, TextUtils.trimToNull(request.comment()));
        if (to == ApplicationStatus.REJECTED) {
            cancelScheduledInterviews(application, "Cancelled automatically because the application was rejected.");
        }
        return toDetail(application, currentUserService.principal());
    }

    /** Records that an accepted intern has completed the internship. */
    @Transactional
    public ApplicationDetailDto markCompleted(Long id) {
        Application application = access.loadForManage(id);
        if (application.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new ConflictException("Only accepted applications can be marked as completed.");
        }
        if (application.getCompletedAt() != null) {
            throw new ConflictException("This internship has already been marked as completed.");
        }
        if (!access.isCompletable(application)) {
            throw new BusinessValidationException("The internship has not started yet (start date "
                    + application.getInternship().getStartDate() + ").");
        }
        application.setCompletedAt(Instant.now());
        auditService.log(AuditAction.APPLICATION_COMPLETED, "Application", id, null);
        return toDetail(application, currentUserService.principal());
    }

    @Transactional(readOnly = true)
    public StudentService.ResumeFile resume(Long id) {
        Application application = access.loadForView(id);
        String name = application.getStudent().getStudentName().replaceAll("[^A-Za-z0-9]+", "_") + "_resume.pdf";
        return new StudentService.ResumeFile(fileStorageService.load(application.getResumePath()), name);
    }

    // ------------------------------------------------------------------ helpers

    private void recordHistory(Application application, ApplicationStatus from, ApplicationStatus to, String comment) {
        ApplicationStatusHistory history = new ApplicationStatusHistory();
        history.setApplication(application);
        history.setOldStatus(from);
        history.setNewStatus(to);
        history.setChangedBy(currentUserService.userReference());
        history.setComment(comment);
        historyRepository.save(history);
    }

    private void cancelScheduledInterviews(Application application, String reason) {
        for (Interview interview : interviewRepository.findByApplicationIdAndStatus(application.getId(), InterviewStatus.SCHEDULED)) {
            interview.setStatus(InterviewStatus.CANCELLED);
            interview.setCancelledAt(Instant.now());
            interview.setComments(reason);
        }
    }

    private ApplicationDetailDto toDetail(Application application, UserPrincipal principal) {
        Long id = application.getId();
        List<Interview> interviews = interviewRepository.findByApplicationIdOrderByInterviewDateAscInterviewTimeAsc(id);
        var evaluations = evaluationMapper.toDtos(evaluationRepository.findByApplicationIdAndArchivedFalse(id));
        StudentFeedbackDto studentFeedback = studentFeedbackRepository.findByApplicationId(id)
                .map(StudentFeedbackDto::from).orElse(null);
        CompanyFeedbackDto companyFeedback = companyFeedbackRepository.findByApplicationId(id)
                .map(CompanyFeedbackDto::from).orElse(null);

        boolean manager = access.canManage(application, principal);
        boolean applicant = access.isApplicant(application, principal);
        ApplicationStatus status = application.getStatus();
        boolean evaluatedByMe = evaluations.stream().anyMatch(e -> e.evaluatorId().equals(principal.id()));
        var actions = new ApplicationDetailDto.Actions(
                manager ? List.copyOf(REVIEW_TRANSITIONS.getOrDefault(status, Set.of())) : List.of(),
                applicant && status == ApplicationStatus.PENDING
                        && internshipService.isAcceptingApplications(application.getInternship()),
                applicant && WITHDRAWABLE.contains(status),
                manager && status == ApplicationStatus.SHORTLISTED
                        && interviews.stream().noneMatch(i -> i.getStatus() == InterviewStatus.SCHEDULED),
                manager && access.isCompletable(application),
                manager && access.isEvaluable(application) && !evaluatedByMe,
                manager && access.isInternshipFinished(application) && companyFeedback == null,
                applicant && access.isInternshipFinished(application) && studentFeedback == null);

        return new ApplicationDetailDto(ApplicationDto.from(application), application.getCoverLetter(),
                application.getQualifications(), timeline(application, interviews),
                interviews.stream().map(InterviewDto::from).toList(), evaluations, studentFeedback, companyFeedback,
                actions);
    }

    /** Builds the timeline strictly from stored timestamps. */
    private List<TimelineEventDto> timeline(Application application, List<Interview> interviews) {
        List<TimelineEventDto> events = new ArrayList<>();
        for (ApplicationStatusHistory h : historyRepository.findByApplicationIdOrderByChangedAtAscIdAsc(application.getId())) {
            events.add(new TimelineEventDto("STATUS_" + h.getNewStatus(), statusTitle(h), h.getComment(),
                    h.getChangedAt(), actorLabel(h.getChangedBy())));
        }
        if (application.getReviewedAt() != null) {
            events.add(new TimelineEventDto("UNDER_REVIEW", "Under review",
                    "The faculty coordinator started reviewing the application.", application.getReviewedAt(), null));
        }
        for (Interview interview : interviews) {
            String slot = interview.getInterviewDate().format(DATE) + " at " + interview.getInterviewTime().format(TIME);
            events.add(new TimelineEventDto("INTERVIEW_SCHEDULED", "Interview scheduled",
                    "Interview with " + interview.getInterviewerName() + " on " + slot + ".", interview.getCreatedAt(), null));
            if (interview.getStatus() == InterviewStatus.COMPLETED && interview.getCompletedAt() != null) {
                events.add(new TimelineEventDto("INTERVIEW_COMPLETED", "Interview completed",
                        "Result: " + humanize(interview.getResult().name()) + ".", interview.getCompletedAt(), null));
            }
            if (interview.getStatus() == InterviewStatus.CANCELLED && interview.getCancelledAt() != null) {
                events.add(new TimelineEventDto("INTERVIEW_CANCELLED", "Interview cancelled",
                        interview.getComments(), interview.getCancelledAt(), null));
            }
        }
        if (application.getCompletedAt() != null) {
            events.add(new TimelineEventDto("COMPLETED", "Internship completed", null, application.getCompletedAt(), null));
        }
        // Equal timestamps (e.g. review started by the first decision) keep a logical order.
        events.sort(Comparator.comparing(TimelineEventDto::timestamp).thenComparing(ApplicationService::eventRank));
        return events;
    }

    private static int eventRank(TimelineEventDto event) {
        return switch (event.type()) {
            case "STATUS_PENDING" -> 0;
            case "UNDER_REVIEW" -> 1;
            default -> 2;
        };
    }

    private static String statusTitle(ApplicationStatusHistory h) {
        if (h.getOldStatus() == null) {
            return "Applied";
        }
        return switch (h.getNewStatus()) {
            case SHORTLISTED -> "Shortlisted";
            case ACCEPTED -> "Accepted";
            case REJECTED -> "Rejected";
            case WITHDRAWN -> "Withdrawn";
            case PENDING -> "Moved back to pending";
        };
    }

    private static String actorLabel(User user) {
        if (user == null) {
            return "System";
        }
        return user.getRole() == Role.STUDENT ? "Student" : user.getRole() == Role.FACULTY ? "Faculty" : "Administrator";
    }

    private static String humanize(String value) {
        String lower = value.replace('_', ' ').toLowerCase();
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
