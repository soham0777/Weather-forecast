package com.cims.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.common.OptionDto;
import com.cims.dto.common.PageResponse;
import com.cims.dto.internship.InternshipDto;
import com.cims.dto.internship.InternshipFilterOptions;
import com.cims.dto.internship.InternshipRequest;
import com.cims.dto.internship.InternshipStatusRequest;
import com.cims.entity.Application;
import com.cims.entity.Company;
import com.cims.entity.Faculty;
import com.cims.entity.Internship;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.CompanyStatus;
import com.cims.entity.enums.InternshipStatus;
import com.cims.entity.enums.InterviewStatus;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ConflictException;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.ApplicationRepository;
import com.cims.repository.CompanyRepository;
import com.cims.repository.FacultyFeedbackRepository;
import com.cims.repository.FacultyRepository;
import com.cims.repository.InternshipRepository;
import com.cims.repository.InterviewRepository;
import com.cims.repository.spec.InternshipSpecifications;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;
import com.cims.validation.InternshipDateRules;

/**
 * Internship catalogue and approval workflow.
 *
 * <pre>
 * Faculty creates ─► PENDING ─► (admin) APPROVED ─► (owner/admin) OPEN ─► CLOSED ─► ARCHIVED
 *                          └──► (admin) REJECTED ─► (faculty edits) PENDING
 * </pre>
 * OPEN internships whose deadline has passed are closed automatically by {@link InternshipScheduler}.
 */
@Service
public class InternshipService {

    /** Statuses students can browse. */
    public static final Set<InternshipStatus> STUDENT_BROWSABLE = EnumSet.of(InternshipStatus.APPROVED, InternshipStatus.OPEN);
    /** Statuses a student may open by direct link. */
    private static final Set<InternshipStatus> STUDENT_VISIBLE =
            EnumSet.of(InternshipStatus.APPROVED, InternshipStatus.OPEN, InternshipStatus.CLOSED);
    private static final Set<ApplicationStatus> ACTIVE_APPLICATION_STATUSES =
            EnumSet.of(ApplicationStatus.PENDING, ApplicationStatus.SHORTLISTED);

    private static final Map<String, String> SORT_KEYS = Map.of(
            "deadline", "applicationDeadline", "stipend", "stipend", "startDate", "startDate",
            "createdAt", "createdAt", "title", "title", "duration", "durationWeeks");

    private final InternshipRepository internshipRepository;
    private final CompanyRepository companyRepository;
    private final FacultyRepository facultyRepository;
    private final ApplicationRepository applicationRepository;
    private final InterviewRepository interviewRepository;
    private final FacultyFeedbackRepository facultyFeedbackRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;
    private final InternshipDateRules dateRules;
    private final Clock clock;

    public InternshipService(InternshipRepository internshipRepository, CompanyRepository companyRepository,
                             FacultyRepository facultyRepository, ApplicationRepository applicationRepository,
                             InterviewRepository interviewRepository, FacultyFeedbackRepository facultyFeedbackRepository,
                             CurrentUserService currentUserService, AuditService auditService,
                             InternshipDateRules dateRules, Clock clock) {
        this.internshipRepository = internshipRepository;
        this.companyRepository = companyRepository;
        this.facultyRepository = facultyRepository;
        this.applicationRepository = applicationRepository;
        this.interviewRepository = interviewRepository;
        this.facultyFeedbackRepository = facultyFeedbackRepository;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
        this.dateRules = dateRules;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ queries

    public record SearchParams(String q, String domain, Long companyId, String location, BigDecimal minStipend,
                               BigDecimal maxStipend, InternshipStatus status, Long facultyId, Integer page,
                               Integer size, String sort) {
    }

    /**
     * Role-aware search: students only see APPROVED/OPEN internships, faculty only their own,
     * administrators everything.
     */
    @Transactional(readOnly = true)
    public PageResponse<InternshipDto> search(SearchParams params) {
        if (params.minStipend() != null && params.maxStipend() != null
                && params.minStipend().compareTo(params.maxStipend()) > 0) {
            throw BusinessValidationException.forField("maxStipend", "Maximum stipend must be greater than or equal to the minimum stipend.");
        }
        UserPrincipal principal = currentUserService.principal();
        Collection<InternshipStatus> statuses;
        Long facultyId = params.facultyId();
        if (principal.isStudent()) {
            statuses = params.status() != null && STUDENT_BROWSABLE.contains(params.status())
                    ? Set.of(params.status()) : STUDENT_BROWSABLE;
            facultyId = null;
        } else {
            statuses = params.status() != null ? Set.of(params.status()) : null;
            if (principal.isFaculty()) {
                facultyId = currentUserService.faculty().getId();
            }
        }

        var filter = new InternshipSpecifications.Filter(TextUtils.likePattern(params.q()), TextUtils.trimToNull(params.domain()),
                params.companyId(), TextUtils.likePattern(params.location()), params.minStipend(), params.maxStipend(),
                statuses, facultyId);
        Sort defaultSort = principal.isStudent()
                ? Sort.by(Sort.Direction.ASC, "applicationDeadline").and(Sort.by(Sort.Direction.DESC, "id"))
                : Sort.by(Sort.Direction.DESC, "createdAt");
        var pageable = PageUtils.of(params.page(), params.size(), params.sort(), SORT_KEYS, defaultSort);
        Page<Internship> page = internshipRepository.findAll(InternshipSpecifications.matching(filter), pageable);
        return PageResponse.of(page, mapperFor(page.getContent(), principal));
    }

    @Transactional(readOnly = true)
    public InternshipDto get(Long id) {
        Internship internship = findDetailed(id);
        UserPrincipal principal = currentUserService.principal();
        assertCanView(internship, principal);
        return mapperFor(List.of(internship), principal).apply(internship);
    }

    /** Values for the search drop-downs, limited to what the current user can browse. */
    @Transactional(readOnly = true)
    public InternshipFilterOptions filterOptions() {
        UserPrincipal principal = currentUserService.principal();
        Collection<InternshipStatus> statuses = principal.isStudent() ? STUDENT_BROWSABLE : EnumSet.allOf(InternshipStatus.class);
        List<OptionDto> companies = companyRepository.findByStatusOrderByNameAsc(CompanyStatus.ACTIVE).stream()
                .map(c -> new OptionDto(c.getId(), c.getName()))
                .toList();
        return new InternshipFilterOptions(internshipRepository.findDistinctDomains(statuses), companies,
                internshipRepository.findDistinctLocations(statuses));
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public InternshipDto create(InternshipRequest request) {
        UserPrincipal principal = currentUserService.principal();
        Company company = activeCompany(request.companyId());
        int weeks = dateRules.validate(request.startDate(), request.endDate(), request.applicationDeadline(),
                request.durationWeeks(), true, true);

        Internship internship = new Internship();
        internship.setCreatedBy(currentUserService.userReference());
        if (principal.isAdmin()) {
            if (request.facultyId() == null) {
                throw BusinessValidationException.forField("facultyId", "Please select the faculty coordinator for this internship.");
            }
            internship.setFaculty(activeFaculty(request.facultyId()));
            // Created by the approving authority itself, so it starts approved.
            internship.setStatus(InternshipStatus.APPROVED);
            internship.setReviewedBy(currentUserService.userReference());
            internship.setReviewedAt(Instant.now());
            internship.setReviewRemarks("Created by administrator");
        } else {
            internship.setFaculty(currentUserService.faculty());
            internship.setStatus(InternshipStatus.PENDING);
        }
        applyFields(internship, request, company, weeks);
        internshipRepository.save(internship);
        auditService.log(AuditAction.INTERNSHIP_CREATED, "Internship", internship.getId(),
                internship.getTitle() + " (" + internship.getStatus() + ")");
        return get(internship.getId());
    }

    @Transactional
    public InternshipDto update(Long id, InternshipRequest request) {
        Internship internship = findDetailed(id);
        UserPrincipal principal = currentUserService.principal();
        assertCanManage(internship, principal);
        if (internship.getStatus() == InternshipStatus.ARCHIVED) {
            throw new ConflictException("Archived internships cannot be edited.");
        }

        Company company = internship.getCompany();
        if (!Objects.equals(company.getId(), request.companyId())) {
            if (applicationRepository.existsByInternshipId(id)) {
                throw new ConflictException("The company cannot be changed after students have applied.");
            }
            company = activeCompany(request.companyId());
        }
        boolean startChanged = !request.startDate().equals(internship.getStartDate());
        boolean deadlineChanged = !request.applicationDeadline().equals(internship.getApplicationDeadline());
        int weeks = dateRules.validate(request.startDate(), request.endDate(), request.applicationDeadline(),
                request.durationWeeks(), startChanged, deadlineChanged);

        if (principal.isAdmin() && request.facultyId() != null
                && !request.facultyId().equals(internship.getFaculty().getId())) {
            internship.setFaculty(activeFaculty(request.facultyId()));
        }
        applyFields(internship, request, company, weeks);

        // A rejected posting that the coordinator edits goes back for approval.
        if (internship.getStatus() == InternshipStatus.REJECTED && principal.isFaculty()) {
            internship.setStatus(InternshipStatus.PENDING);
        }
        auditService.log(AuditAction.INTERNSHIP_UPDATED, "Internship", id, internship.getTitle());
        return get(id);
    }

    @Transactional
    public InternshipDto changeStatus(Long id, InternshipStatusRequest request) {
        Internship internship = findDetailed(id);
        UserPrincipal principal = currentUserService.principal();
        InternshipStatus from = internship.getStatus();
        InternshipStatus to = request.status();
        String remarks = TextUtils.trimToNull(request.remarks());

        switch (to) {
            case APPROVED -> {
                requireAdmin(principal, "Only administrators can approve internships.");
                requireFrom(from, to, InternshipStatus.PENDING);
                markReviewed(internship, remarks);
            }
            case REJECTED -> {
                requireAdmin(principal, "Only administrators can reject internships.");
                requireFrom(from, to, InternshipStatus.PENDING);
                if (remarks == null) {
                    throw BusinessValidationException.forField("remarks", "Please give a reason for rejecting this internship.");
                }
                markReviewed(internship, remarks);
            }
            case OPEN -> {
                assertCanManage(internship, principal);
                requireFrom(from, to, InternshipStatus.APPROVED, InternshipStatus.CLOSED);
                if (internship.getApplicationDeadline().isBefore(LocalDate.now(clock))) {
                    throw new BusinessValidationException("The application deadline has passed. Update the deadline before opening applications.");
                }
                if (internship.getCompany().getStatus() != CompanyStatus.ACTIVE) {
                    throw new ConflictException("The company for this internship is archived.");
                }
            }
            case CLOSED -> {
                assertCanManage(internship, principal);
                requireFrom(from, to, InternshipStatus.OPEN);
            }
            default -> throw new BusinessValidationException(
                    "Status " + to + " cannot be set directly. Use edit (PENDING) or delete (ARCHIVED) instead.");
        }
        internship.setStatus(to);
        auditService.log(AuditAction.INTERNSHIP_STATUS_CHANGED, "Internship", id,
                from + " -> " + to + (remarks != null ? ": " + remarks : ""));
        return get(id);
    }

    /**
     * Removes an internship according to its state: a PENDING/REJECTED posting with no
     * dependent records is deleted; anything else is ARCHIVED so its history is preserved.
     *
     * @return true if the row was physically deleted, false if it was archived
     */
    @Transactional
    public boolean delete(Long id) {
        Internship internship = findDetailed(id);
        assertCanManage(internship, currentUserService.principal());
        if (internship.getStatus() == InternshipStatus.ARCHIVED) {
            throw new ConflictException("This internship is already archived.");
        }
        boolean hasApplications = applicationRepository.existsByInternshipId(id);
        boolean deletable = !hasApplications && !facultyFeedbackRepository.existsByInternshipId(id)
                && EnumSet.of(InternshipStatus.PENDING, InternshipStatus.REJECTED).contains(internship.getStatus());
        if (deletable) {
            internshipRepository.delete(internship);
            auditService.log(AuditAction.INTERNSHIP_DELETED, "Internship", id, internship.getTitle());
            return true;
        }
        if (applicationRepository.existsByInternshipIdAndStatusIn(id, ACTIVE_APPLICATION_STATUSES)) {
            throw new ConflictException("This internship still has pending or shortlisted applications. "
                    + "Close it and accept or reject those applications before archiving.");
        }
        if (interviewRepository.existsByApplicationInternshipIdAndStatus(id, InterviewStatus.SCHEDULED)) {
            throw new ConflictException("This internship has scheduled interviews. Complete or cancel them before archiving.");
        }
        InternshipStatus from = internship.getStatus();
        internship.setStatus(InternshipStatus.ARCHIVED);
        auditService.log(AuditAction.INTERNSHIP_STATUS_CHANGED, "Internship", id, from + " -> ARCHIVED");
        return false;
    }

    /** Closes OPEN internships whose deadline has passed. Returns the number closed. */
    @Transactional
    public int closeExpiredInternships() {
        return internshipRepository.closeExpired(LocalDate.now(clock), Instant.now());
    }

    // ------------------------------------------------------------------ helpers used by other services

    public boolean isAcceptingApplications(Internship internship) {
        return internship.getStatus() == InternshipStatus.OPEN
                && !internship.getApplicationDeadline().isBefore(LocalDate.now(clock));
    }

    /** Faculty may only manage internships they coordinate; admins may manage all. */
    public void assertCanManage(Internship internship, UserPrincipal principal) {
        if (principal.isAdmin()) {
            return;
        }
        if (principal.isFaculty() && internship.getFaculty().getUser().getId().equals(principal.id())) {
            return;
        }
        throw new ForbiddenException("You can only manage internships that you coordinate.");
    }

    // ------------------------------------------------------------------ private helpers

    private void assertCanView(Internship internship, UserPrincipal principal) {
        if (principal.isAdmin()) {
            return;
        }
        if (principal.isFaculty()) {
            boolean own = internship.getFaculty().getUser().getId().equals(principal.id());
            if (own || STUDENT_VISIBLE.contains(internship.getStatus())) {
                return;
            }
        }
        if (principal.isStudent()) {
            if (STUDENT_VISIBLE.contains(internship.getStatus())) {
                return;
            }
            Long studentId = currentUserService.student().getId();
            if (applicationRepository.existsByStudentIdAndInternshipId(studentId, internship.getId())) {
                return;
            }
        }
        throw new NotFoundException("Internship with id " + internship.getId() + " was not found.");
    }

    private Function<Internship, InternshipDto> mapperFor(List<Internship> internships, UserPrincipal principal) {
        List<Long> ids = internships.stream().map(Internship::getId).toList();
        Map<Long, Long> counts = new HashMap<>();
        Map<Long, Application> mine = new HashMap<>();
        if (!ids.isEmpty()) {
            if (principal.isStudent()) {
                Long studentId = currentUserService.student().getId();
                applicationRepository.findByStudentAndInternshipIds(studentId, ids)
                        .forEach(a -> mine.put(a.getInternship().getId(), a));
            } else {
                for (Object[] row : applicationRepository.countByInternshipIds(ids)) {
                    counts.put((Long) row[0], (Long) row[1]);
                }
            }
        }
        boolean staff = !principal.isStudent();
        return internship -> {
            Application application = mine.get(internship.getId());
            return new InternshipDto(internship.getId(), internship.getTitle(), internship.getDescription(),
                    internship.getDomain(), internship.getCompany().getId(), internship.getCompany().getName(),
                    internship.getCompany().getLocation(), internship.getFaculty().getId(),
                    internship.getFaculty().getName(), internship.getDurationWeeks(), internship.getStipend(),
                    internship.getStartDate(), internship.getEndDate(), internship.getApplicationDeadline(),
                    internship.getStatus(), isAcceptingApplications(internship),
                    staff || internship.getStatus() == InternshipStatus.REJECTED ? internship.getReviewRemarks() : null,
                    staff ? internship.getReviewedAt() : null,
                    staff ? counts.getOrDefault(internship.getId(), 0L) : null,
                    application != null ? application.getId() : null,
                    application != null ? application.getStatus() : null,
                    internship.getCreatedAt(), internship.getUpdatedAt());
        };
    }

    private Internship findDetailed(Long id) {
        return internshipRepository.findDetailedById(id).orElseThrow(() -> NotFoundException.of("Internship", id));
    }

    private Company activeCompany(Long companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> BusinessValidationException.forField("companyId", "The selected company does not exist."));
        if (company.getStatus() != CompanyStatus.ACTIVE) {
            throw BusinessValidationException.forField("companyId", "The selected company is archived.");
        }
        return company;
    }

    private Faculty activeFaculty(Long facultyId) {
        Faculty faculty = facultyRepository.findWithUserById(facultyId)
                .orElseThrow(() -> BusinessValidationException.forField("facultyId", "The selected faculty member does not exist."));
        if (!faculty.getUser().isActive()) {
            throw BusinessValidationException.forField("facultyId", "The selected faculty member's account is inactive.");
        }
        return faculty;
    }

    private void markReviewed(Internship internship, String remarks) {
        internship.setReviewedBy(currentUserService.userReference());
        internship.setReviewedAt(Instant.now());
        internship.setReviewRemarks(remarks);
    }

    private static void applyFields(Internship internship, InternshipRequest request, Company company, int weeks) {
        internship.setCompany(company);
        internship.setTitle(request.title().trim());
        internship.setDescription(request.description().trim());
        internship.setDomain(request.domain().trim());
        internship.setStipend(request.stipend());
        internship.setStartDate(request.startDate());
        internship.setEndDate(request.endDate());
        internship.setApplicationDeadline(request.applicationDeadline());
        internship.setDurationWeeks(weeks);
    }

    private static void requireAdmin(UserPrincipal principal, String message) {
        if (!principal.isAdmin()) {
            throw new ForbiddenException(message);
        }
    }

    private static void requireFrom(InternshipStatus from, InternshipStatus to, InternshipStatus... allowed) {
        for (InternshipStatus status : allowed) {
            if (status == from) {
                return;
            }
        }
        String allowedText = java.util.Arrays.stream(allowed).map(Enum::name).collect(Collectors.joining(" or "));
        throw new ConflictException("An internship can only be moved to " + to + " from " + allowedText
                + " (current status: " + from + ").");
    }
}
