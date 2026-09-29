package com.cims.service;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.stereotype.Service;

import com.cims.entity.Application;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.ApplicationRepository;
import com.cims.security.UserPrincipal;

/**
 * Central place for "who may see / manage this application" and the lifecycle rules that
 * interviews, evaluations and feedback depend on.
 */
@Service
public class ApplicationAccessService {

    private final ApplicationRepository applicationRepository;
    private final CurrentUserService currentUserService;
    private final Clock clock;

    public ApplicationAccessService(ApplicationRepository applicationRepository, CurrentUserService currentUserService,
                                    Clock clock) {
        this.applicationRepository = applicationRepository;
        this.currentUserService = currentUserService;
        this.clock = clock;
    }

    public Application load(Long id) {
        return applicationRepository.findDetailedById(id).orElseThrow(() -> NotFoundException.of("Application", id));
    }

    /** Student who applied, faculty coordinator of the internship, or admin. */
    public Application loadForView(Long id) {
        Application application = load(id);
        if (!canView(application, currentUserService.principal())) {
            throw new ForbiddenException("You do not have access to this application.");
        }
        return application;
    }

    /** Faculty coordinator of the internship or admin. */
    public Application loadForManage(Long id) {
        Application application = load(id);
        if (!canManage(application, currentUserService.principal())) {
            throw new ForbiddenException("Only the internship's faculty coordinator or an administrator can do this.");
        }
        return application;
    }

    public boolean canView(Application application, UserPrincipal principal) {
        return canManage(application, principal) || isApplicant(application, principal);
    }

    public boolean canManage(Application application, UserPrincipal principal) {
        return principal.isAdmin() || (principal.isFaculty()
                && application.getInternship().getFaculty().getUser().getId().equals(principal.id()));
    }

    public boolean isApplicant(Application application, UserPrincipal principal) {
        return principal.isStudent() && application.getStudent().getUser().getId().equals(principal.id());
    }

    /** Evaluations are allowed for accepted interns once the internship has started. */
    public boolean isEvaluable(Application application) {
        return application.getStatus() == ApplicationStatus.ACCEPTED
                && !LocalDate.now(clock).isBefore(application.getInternship().getStartDate());
    }

    /** Post-internship feedback: accepted and either marked completed or past the end date. */
    public boolean isInternshipFinished(Application application) {
        return application.getStatus() == ApplicationStatus.ACCEPTED
                && (application.getCompletedAt() != null
                || application.getInternship().getEndDate().isBefore(LocalDate.now(clock)));
    }

    /** Completion can be recorded for accepted interns once the internship has started. */
    public boolean isCompletable(Application application) {
        return application.getStatus() == ApplicationStatus.ACCEPTED && application.getCompletedAt() == null
                && !LocalDate.now(clock).isBefore(application.getInternship().getStartDate());
    }
}
