package com.cims.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.common.PageResponse;
import com.cims.dto.interview.InterviewDto;
import com.cims.dto.interview.InterviewRequest;
import com.cims.dto.interview.InterviewResultRequest;
import com.cims.dto.interview.InterviewUpdateRequest;
import com.cims.entity.Application;
import com.cims.entity.Interview;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.InterviewStatus;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ConflictException;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.InterviewRepository;
import com.cims.repository.spec.InterviewSpecifications;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;
import com.cims.validation.InterviewSlotRules;

/** Interview scheduling for shortlisted applications. Cancellation is status-based. */
@Service
public class InterviewService {

    private static final Map<String, String> SORT_KEYS = Map.of(
            "date", "interviewDate", "status", "status", "createdAt", "createdAt");

    private final InterviewRepository interviewRepository;
    private final ApplicationAccessService access;
    private final InterviewSlotRules slotRules;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;
    private final Clock clock;

    public InterviewService(InterviewRepository interviewRepository, ApplicationAccessService access,
                            InterviewSlotRules slotRules, CurrentUserService currentUserService,
                            AuditService auditService, Clock clock) {
        this.interviewRepository = interviewRepository;
        this.access = access;
        this.slotRules = slotRules;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
        this.clock = clock;
    }

    public record SearchParams(InterviewStatus status, String scope, Long applicationId, String q, Integer page,
                               Integer size, String sort) {
    }

    @Transactional(readOnly = true)
    public PageResponse<InterviewDto> search(SearchParams params) {
        UserPrincipal principal = currentUserService.principal();
        Long studentId = principal.isStudent() ? currentUserService.student().getId() : null;
        Long facultyId = principal.isFaculty() ? currentUserService.faculty().getId() : null;
        var filter = new InterviewSpecifications.Filter(studentId, facultyId, params.applicationId(), params.status(),
                params.scope(), LocalDate.now(clock), TextUtils.likePattern(params.q()));
        Sort defaultSort = "past".equalsIgnoreCase(params.scope())
                ? Sort.by(Sort.Direction.DESC, "interviewDate").and(Sort.by(Sort.Direction.DESC, "interviewTime"))
                : Sort.by(Sort.Direction.ASC, "interviewDate").and(Sort.by(Sort.Direction.ASC, "interviewTime"));
        var pageable = PageUtils.of(params.page(), params.size(), params.sort(), SORT_KEYS, defaultSort);
        return PageResponse.of(interviewRepository.findAll(InterviewSpecifications.matching(filter), pageable),
                InterviewDto::from);
    }

    @Transactional(readOnly = true)
    public InterviewDto get(Long id) {
        Interview interview = find(id);
        if (!access.canView(interview.getApplication(), currentUserService.principal())) {
            throw new ForbiddenException("You do not have access to this interview.");
        }
        return InterviewDto.from(interview);
    }

    @Transactional
    public InterviewDto schedule(InterviewRequest request) {
        Application application = access.loadForManage(request.applicationId());
        if (application.getStatus() != ApplicationStatus.SHORTLISTED) {
            throw new ConflictException("Interviews can only be scheduled for shortlisted applications (current status: "
                    + application.getStatus() + ").");
        }
        if (interviewRepository.existsByApplicationIdAndStatus(application.getId(), InterviewStatus.SCHEDULED)) {
            throw new ConflictException("This application already has a scheduled interview. Reschedule or cancel it instead.");
        }
        slotRules.validate(request.interviewDate(), request.interviewTime(), application.getInternship());

        Interview interview = new Interview();
        interview.setApplication(application);
        interview.setInterviewDate(request.interviewDate());
        interview.setInterviewTime(request.interviewTime());
        interview.setInterviewerName(request.interviewerName().trim());
        interview.setInterviewerDetails(TextUtils.trimToNull(request.interviewerDetails()));
        interview.setStatus(InterviewStatus.SCHEDULED);
        interview.setScheduledBy(currentUserService.userReference());
        interviewRepository.save(interview);
        auditService.log(AuditAction.INTERVIEW_SCHEDULED, "Interview", interview.getId(),
                "Application " + application.getId() + " on " + request.interviewDate() + " " + request.interviewTime());
        return InterviewDto.from(interview);
    }

    /** Reschedule and/or edit interviewer details and comments. */
    @Transactional
    public InterviewDto update(Long id, InterviewUpdateRequest request) {
        Interview interview = findManageable(id);
        requireScheduled(interview, "Only scheduled interviews can be rescheduled.");
        boolean slotChanged = !request.interviewDate().equals(interview.getInterviewDate())
                || !request.interviewTime().equals(interview.getInterviewTime());
        if (slotChanged) {
            slotRules.validate(request.interviewDate(), request.interviewTime(), interview.getApplication().getInternship());
        }
        interview.setInterviewDate(request.interviewDate());
        interview.setInterviewTime(request.interviewTime());
        interview.setInterviewerName(request.interviewerName().trim());
        interview.setInterviewerDetails(TextUtils.trimToNull(request.interviewerDetails()));
        interview.setComments(TextUtils.trimToNull(request.comments()));
        auditService.log(AuditAction.INTERVIEW_UPDATED, "Interview", id,
                slotChanged ? "Rescheduled to " + request.interviewDate() + " " + request.interviewTime() : "Details updated");
        return InterviewDto.from(interview);
    }

    /** Records the result; only possible once the interview time has passed. */
    @Transactional
    public InterviewDto recordResult(Long id, InterviewResultRequest request) {
        Interview interview = findManageable(id);
        requireScheduled(interview, "A result can only be recorded for a scheduled interview.");
        LocalDateTime slot = LocalDateTime.of(interview.getInterviewDate(), interview.getInterviewTime());
        if (slot.isAfter(LocalDateTime.now(clock))) {
            throw new BusinessValidationException("The interview has not taken place yet. Record the result after the interview.");
        }
        interview.setStatus(InterviewStatus.COMPLETED);
        interview.setResult(request.result());
        interview.setComments(TextUtils.trimToNull(request.comments()));
        interview.setCompletedAt(Instant.now());
        auditService.log(AuditAction.INTERVIEW_COMPLETED, "Interview", id, "Result: " + request.result());
        return InterviewDto.from(interview);
    }

    @Transactional
    public InterviewDto cancel(Long id, String reason) {
        Interview interview = findManageable(id);
        requireScheduled(interview, "Only scheduled interviews can be cancelled.");
        String trimmed = TextUtils.trimToNull(reason);
        if (trimmed != null && trimmed.length() > 1000) {
            throw BusinessValidationException.forField("reason", "Reason must be at most 1000 characters.");
        }
        interview.setStatus(InterviewStatus.CANCELLED);
        interview.setCancelledAt(Instant.now());
        interview.setComments(trimmed != null ? trimmed : "Cancelled by the faculty coordinator.");
        auditService.log(AuditAction.INTERVIEW_CANCELLED, "Interview", id, trimmed);
        return InterviewDto.from(interview);
    }

    private Interview find(Long id) {
        return interviewRepository.findDetailedById(id).orElseThrow(() -> NotFoundException.of("Interview", id));
    }

    private Interview findManageable(Long id) {
        Interview interview = find(id);
        if (!access.canManage(interview.getApplication(), currentUserService.principal())) {
            throw new ForbiddenException("Only the internship's faculty coordinator or an administrator can manage this interview.");
        }
        return interview;
    }

    private static void requireScheduled(Interview interview, String message) {
        if (interview.getStatus() != InterviewStatus.SCHEDULED) {
            throw new ConflictException(message + " (current status: " + interview.getStatus() + ")");
        }
    }
}
