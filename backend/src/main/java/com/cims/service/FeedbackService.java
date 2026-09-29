package com.cims.service;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.common.PageResponse;
import com.cims.dto.feedback.CompanyFeedbackDto;
import com.cims.dto.feedback.CompanyFeedbackRequest;
import com.cims.dto.feedback.FacultyFeedbackDto;
import com.cims.dto.feedback.FacultyFeedbackRequest;
import com.cims.dto.feedback.StudentFeedbackDto;
import com.cims.dto.feedback.StudentFeedbackRequest;
import com.cims.dto.feedback.SystemFeedbackDto;
import com.cims.dto.feedback.SystemFeedbackRequest;
import com.cims.dto.feedback.SystemFeedbackStatusRequest;
import com.cims.entity.Application;
import com.cims.entity.CompanyFeedback;
import com.cims.entity.Faculty;
import com.cims.entity.FacultyFeedback;
import com.cims.entity.Internship;
import com.cims.entity.StudentFeedback;
import com.cims.entity.SystemFeedback;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.InternshipStatus;
import com.cims.entity.enums.SystemFeedbackStatus;
import com.cims.entity.enums.SystemFeedbackType;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ConflictException;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.CompanyFeedbackRepository;
import com.cims.repository.FacultyFeedbackRepository;
import com.cims.repository.InternshipRepository;
import com.cims.repository.StudentFeedbackRepository;
import com.cims.repository.SystemFeedbackRepository;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;

/**
 * The four feedback categories:
 * <ul>
 *   <li>student feedback – the intern rates the company after the internship;</li>
 *   <li>company feedback – the company's rating of the intern, recorded by faculty/admin;</li>
 *   <li>faculty feedback – quality assurance of an internship by its coordinator;</li>
 *   <li>system feedback – suggestions and bug reports from any user, triaged by admins.</li>
 * </ul>
 */
@Service
public class FeedbackService {

    private static final Map<String, String> SORT_KEYS = Map.of("createdAt", "createdAt", "updatedAt", "updatedAt");
    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt");
    private static final Set<InternshipStatus> REVIEWABLE_INTERNSHIP =
            EnumSet.of(InternshipStatus.APPROVED, InternshipStatus.OPEN, InternshipStatus.CLOSED, InternshipStatus.ARCHIVED);

    private final StudentFeedbackRepository studentFeedbackRepository;
    private final CompanyFeedbackRepository companyFeedbackRepository;
    private final FacultyFeedbackRepository facultyFeedbackRepository;
    private final SystemFeedbackRepository systemFeedbackRepository;
    private final InternshipRepository internshipRepository;
    private final ApplicationAccessService access;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    public FeedbackService(StudentFeedbackRepository studentFeedbackRepository,
                           CompanyFeedbackRepository companyFeedbackRepository,
                           FacultyFeedbackRepository facultyFeedbackRepository,
                           SystemFeedbackRepository systemFeedbackRepository, InternshipRepository internshipRepository,
                           ApplicationAccessService access, CurrentUserService currentUserService,
                           AuditService auditService) {
        this.studentFeedbackRepository = studentFeedbackRepository;
        this.companyFeedbackRepository = companyFeedbackRepository;
        this.facultyFeedbackRepository = facultyFeedbackRepository;
        this.systemFeedbackRepository = systemFeedbackRepository;
        this.internshipRepository = internshipRepository;
        this.access = access;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
    }

    // ================================================================== student feedback

    @Transactional(readOnly = true)
    public PageResponse<StudentFeedbackDto> searchStudentFeedback(Long companyId, Integer page, Integer size, String sort) {
        UserPrincipal principal = currentUserService.principal();
        Long studentId = principal.isStudent() ? currentUserService.student().getId() : null;
        Long facultyId = principal.isFaculty() ? currentUserService.faculty().getId() : null;
        var pageable = PageUtils.of(page, size, sort, SORT_KEYS, NEWEST_FIRST);
        return PageResponse.of(studentFeedbackRepository.search(studentId, facultyId, companyId, pageable),
                StudentFeedbackDto::from);
    }

    @Transactional
    public StudentFeedbackDto createStudentFeedback(StudentFeedbackRequest request) {
        Application application = access.loadForView(request.applicationId());
        if (!access.isApplicant(application, currentUserService.principal())) {
            throw new ForbiddenException("Only the intern can submit feedback for this internship.");
        }
        if (!access.isInternshipFinished(application)) {
            throw new BusinessValidationException(
                    "Feedback can be submitted after your accepted internship has been completed.");
        }
        if (studentFeedbackRepository.existsByApplicationId(application.getId())) {
            throw new ConflictException("Feedback has already been submitted for this internship. You can edit it instead.");
        }
        StudentFeedback feedback = new StudentFeedback();
        feedback.setApplication(application);
        apply(feedback, request);
        studentFeedbackRepository.saveAndFlush(feedback);
        return StudentFeedbackDto.from(feedback);
    }

    @Transactional
    public StudentFeedbackDto updateStudentFeedback(Long id, StudentFeedbackRequest request) {
        StudentFeedback feedback = studentFeedbackRepository.findDetailedById(id)
                .orElseThrow(() -> NotFoundException.of("Student feedback", id));
        if (!access.isApplicant(feedback.getApplication(), currentUserService.principal())) {
            throw new ForbiddenException("You can only edit your own feedback.");
        }
        requireSameApplication(feedback.getApplication(), request.applicationId());
        apply(feedback, request);
        return StudentFeedbackDto.from(feedback);
    }

    // ================================================================== company feedback

    @Transactional(readOnly = true)
    public PageResponse<CompanyFeedbackDto> searchCompanyFeedback(Long companyId, Integer page, Integer size, String sort) {
        UserPrincipal principal = currentUserService.principal();
        Long studentId = principal.isStudent() ? currentUserService.student().getId() : null;
        Long facultyId = principal.isFaculty() ? currentUserService.faculty().getId() : null;
        var pageable = PageUtils.of(page, size, sort, SORT_KEYS, NEWEST_FIRST);
        return PageResponse.of(companyFeedbackRepository.search(studentId, facultyId, companyId, pageable),
                CompanyFeedbackDto::from);
    }

    @Transactional
    public CompanyFeedbackDto createCompanyFeedback(CompanyFeedbackRequest request) {
        Application application = access.loadForManage(request.applicationId());
        if (!access.isInternshipFinished(application)) {
            throw new BusinessValidationException(
                    "Company feedback can be recorded once the accepted intern has completed the internship.");
        }
        if (companyFeedbackRepository.existsByApplicationId(application.getId())) {
            throw new ConflictException("Company feedback has already been recorded for this student. Edit it instead.");
        }
        CompanyFeedback feedback = new CompanyFeedback();
        feedback.setApplication(application);
        feedback.setRecordedBy(currentUserService.userReference());
        apply(feedback, request);
        companyFeedbackRepository.saveAndFlush(feedback);
        return CompanyFeedbackDto.from(companyFeedbackRepository.findDetailedById(feedback.getId()).orElseThrow());
    }

    @Transactional
    public CompanyFeedbackDto updateCompanyFeedback(Long id, CompanyFeedbackRequest request) {
        CompanyFeedback feedback = companyFeedbackRepository.findDetailedById(id)
                .orElseThrow(() -> NotFoundException.of("Company feedback", id));
        if (!access.canManage(feedback.getApplication(), currentUserService.principal())) {
            throw new ForbiddenException("Only the internship's faculty coordinator or an administrator can edit this feedback.");
        }
        requireSameApplication(feedback.getApplication(), request.applicationId());
        apply(feedback, request);
        return CompanyFeedbackDto.from(feedback);
    }

    // ================================================================== faculty feedback

    @Transactional(readOnly = true)
    public PageResponse<FacultyFeedbackDto> searchFacultyFeedback(Long internshipId, Integer page, Integer size, String sort) {
        UserPrincipal principal = currentUserService.principal();
        if (principal.isStudent()) {
            throw new ForbiddenException("Faculty feedback is only available to faculty and administrators.");
        }
        Long facultyId = principal.isFaculty() ? currentUserService.faculty().getId() : null;
        var pageable = PageUtils.of(page, size, sort, SORT_KEYS, NEWEST_FIRST);
        return PageResponse.of(facultyFeedbackRepository.search(facultyId, internshipId, pageable), FacultyFeedbackDto::from);
    }

    @Transactional
    public FacultyFeedbackDto createFacultyFeedback(FacultyFeedbackRequest request) {
        Faculty faculty = currentUserService.faculty();
        Internship internship = internshipRepository.findDetailedById(request.internshipId())
                .orElseThrow(() -> NotFoundException.of("Internship", request.internshipId()));
        if (!internship.getFaculty().getId().equals(faculty.getId())) {
            throw new ForbiddenException("You can only give feedback on internships that you coordinate.");
        }
        if (!REVIEWABLE_INTERNSHIP.contains(internship.getStatus())) {
            throw new BusinessValidationException("Feedback can only be given for approved internships.");
        }
        if (facultyFeedbackRepository.existsByInternshipIdAndFacultyId(internship.getId(), faculty.getId())) {
            throw new ConflictException("You have already submitted feedback for this internship. Edit it instead.");
        }
        FacultyFeedback feedback = new FacultyFeedback();
        feedback.setInternship(internship);
        feedback.setFaculty(faculty);
        apply(feedback, request);
        facultyFeedbackRepository.saveAndFlush(feedback);
        return FacultyFeedbackDto.from(feedback);
    }

    @Transactional
    public FacultyFeedbackDto updateFacultyFeedback(Long id, FacultyFeedbackRequest request) {
        FacultyFeedback feedback = facultyFeedbackRepository.findDetailedById(id)
                .orElseThrow(() -> NotFoundException.of("Faculty feedback", id));
        if (!feedback.getFaculty().getUser().getId().equals(currentUserService.principal().id())) {
            throw new ForbiddenException("You can only edit your own feedback.");
        }
        if (!feedback.getInternship().getId().equals(request.internshipId())) {
            throw BusinessValidationException.forField("internshipId", "The internship of a feedback entry cannot be changed.");
        }
        apply(feedback, request);
        return FacultyFeedbackDto.from(feedback);
    }

    // ================================================================== system feedback

    @Transactional(readOnly = true)
    public PageResponse<SystemFeedbackDto> searchSystemFeedback(SystemFeedbackType type, SystemFeedbackStatus status,
                                                                String q, Integer page, Integer size, String sort) {
        UserPrincipal principal = currentUserService.principal();
        Long userId = principal.isAdmin() ? null : principal.id();
        var pageable = PageUtils.of(page, size, sort, Map.of("createdAt", "createdAt", "updatedAt", "updatedAt",
                "status", "status"), NEWEST_FIRST);
        return PageResponse.of(systemFeedbackRepository.search(userId, type, status, TextUtils.likePattern(q), pageable),
                SystemFeedbackDto::from);
    }

    @Transactional
    public SystemFeedbackDto createSystemFeedback(SystemFeedbackRequest request) {
        SystemFeedback feedback = new SystemFeedback();
        feedback.setSubmittedBy(currentUserService.user());
        feedback.setStatus(SystemFeedbackStatus.OPEN);
        applySystem(feedback, request);
        systemFeedbackRepository.saveAndFlush(feedback);
        return SystemFeedbackDto.from(feedback);
    }

    /** The author may edit their own feedback while it is still OPEN. */
    @Transactional
    public SystemFeedbackDto updateSystemFeedback(Long id, SystemFeedbackRequest request) {
        SystemFeedback feedback = findSystem(id);
        if (!feedback.getSubmittedBy().getId().equals(currentUserService.principal().id())) {
            throw new ForbiddenException("You can only edit feedback that you submitted.");
        }
        if (feedback.getStatus() != SystemFeedbackStatus.OPEN) {
            throw new ConflictException("Feedback can no longer be edited after an administrator has started reviewing it.");
        }
        applySystem(feedback, request);
        return SystemFeedbackDto.from(feedback);
    }

    /** Admin triage: status and response. */
    @Transactional
    public SystemFeedbackDto updateSystemFeedbackStatus(Long id, SystemFeedbackStatusRequest request) {
        SystemFeedback feedback = findSystem(id);
        SystemFeedbackStatus from = feedback.getStatus();
        feedback.setStatus(request.status());
        feedback.setAdminResponse(TextUtils.trimToNull(request.adminResponse()));
        feedback.setHandledBy(currentUserService.user());
        auditService.log(AuditAction.SYSTEM_FEEDBACK_UPDATED, "SystemFeedback", id, from + " -> " + request.status());
        return SystemFeedbackDto.from(feedback);
    }

    // ================================================================== helpers

    private SystemFeedback findSystem(Long id) {
        return systemFeedbackRepository.findDetailedById(id).orElseThrow(() -> NotFoundException.of("Feedback", id));
    }

    private static void requireSameApplication(Application application, Long requestedId) {
        if (!application.getId().equals(requestedId)) {
            throw BusinessValidationException.forField("applicationId", "The application of a feedback entry cannot be changed.");
        }
    }

    private static void apply(StudentFeedback f, StudentFeedbackRequest r) {
        f.setCompanyCulture(r.companyCulture());
        f.setMentorshipQuality(r.mentorshipQuality());
        f.setTechnicalLearning(r.technicalLearning());
        f.setWorkEnvironment(r.workEnvironment());
        f.setOverallExperience(r.overallExperience());
        f.setComments(TextUtils.trimToNull(r.comments()));
        f.setSuggestions(TextUtils.trimToNull(r.suggestions()));
    }

    private static void apply(CompanyFeedback f, CompanyFeedbackRequest r) {
        f.setCompanyRepresentative(TextUtils.trimToNull(r.companyRepresentative()));
        f.setTechnicalSkills(r.technicalSkills());
        f.setSoftSkills(r.softSkills());
        f.setPunctuality(r.punctuality());
        f.setResponsibility(r.responsibility());
        f.setTeamwork(r.teamwork());
        f.setLearningAbility(r.learningAbility());
        f.setHireLikelihood(r.hireLikelihood());
        f.setStrengths(TextUtils.trimToNull(r.strengths()));
        f.setAreasForImprovement(TextUtils.trimToNull(r.areasForImprovement()));
        f.setComments(TextUtils.trimToNull(r.comments()));
    }

    private static void apply(FacultyFeedback f, FacultyFeedbackRequest r) {
        f.setCourseSuitability(r.courseSuitability());
        f.setLearningOutcomes(r.learningOutcomes());
        f.setInternshipQuality(r.internshipQuality());
        f.setLearningOutcomesNotes(TextUtils.trimToNull(r.learningOutcomesNotes()));
        f.setSuggestions(TextUtils.trimToNull(r.suggestions()));
    }

    private static void applySystem(SystemFeedback f, SystemFeedbackRequest r) {
        f.setFeedbackType(r.feedbackType());
        f.setTitle(r.title().trim());
        f.setDescription(r.description().trim());
    }
}
