package com.cims.service;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.application.ApplicationDto;
import com.cims.dto.common.PageResponse;
import com.cims.dto.evaluation.EvaluationDto;
import com.cims.dto.evaluation.EvaluationRequest;
import com.cims.entity.Application;
import com.cims.entity.Evaluation;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.AuditAction;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ConflictException;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.ApplicationRepository;
import com.cims.repository.EvaluationRepository;
import com.cims.repository.spec.ApplicationSpecifications;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;

/** Evaluations of accepted interns by the faculty coordinator or an administrator. */
@Service
public class EvaluationService {

    private static final Map<String, String> SORT_KEYS = Map.of(
            "createdAt", "createdAt", "overallRating", "overallRating", "updatedAt", "updatedAt");

    private final EvaluationRepository evaluationRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationAccessService access;
    private final EvaluationMapper mapper;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    public EvaluationService(EvaluationRepository evaluationRepository, ApplicationRepository applicationRepository,
                             ApplicationAccessService access, EvaluationMapper mapper,
                             CurrentUserService currentUserService, AuditService auditService) {
        this.evaluationRepository = evaluationRepository;
        this.applicationRepository = applicationRepository;
        this.access = access;
        this.mapper = mapper;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResponse<EvaluationDto> search(Long internshipId, boolean includeArchived, String q, Integer page,
                                              Integer size, String sort) {
        UserPrincipal principal = currentUserService.principal();
        Long studentId = principal.isStudent() ? currentUserService.student().getId() : null;
        Long facultyId = principal.isFaculty() ? currentUserService.faculty().getId() : null;
        boolean archived = includeArchived && !principal.isStudent();
        var pageable = PageUtils.of(page, size, sort, SORT_KEYS, Sort.by(Sort.Direction.DESC, "createdAt"));
        var result = evaluationRepository.search(studentId, facultyId, internshipId, archived, TextUtils.likePattern(q), pageable);
        List<EvaluationDto> dtos = mapper.toDtos(result.getContent());
        return new PageResponse<>(dtos, result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages(), result.isFirst(), result.isLast());
    }

    @Transactional(readOnly = true)
    public EvaluationDto get(Long id) {
        Evaluation evaluation = find(id);
        UserPrincipal principal = currentUserService.principal();
        if (!access.canView(evaluation.getApplication(), principal)
                || (principal.isStudent() && evaluation.isArchived())) {
            throw new ForbiddenException("You do not have access to this evaluation.");
        }
        return mapper.toDto(evaluation);
    }

    /** Accepted interns on the caller's internships that the caller has not evaluated yet. */
    @Transactional(readOnly = true)
    public List<ApplicationDto> pending() {
        UserPrincipal principal = currentUserService.principal();
        Long facultyId = principal.isFaculty() ? currentUserService.faculty().getId() : null;
        var filter = new ApplicationSpecifications.Filter(null, facultyId, null, null, ApplicationStatus.ACCEPTED, null);
        return applicationRepository.findAll(ApplicationSpecifications.matching(filter), Sort.by("updatedAt")).stream()
                .filter(access::isEvaluable)
                .filter(a -> evaluationRepository.findByApplicationIdAndEvaluatorId(a.getId(), principal.id())
                        .map(Evaluation::isArchived).orElse(true))
                .map(ApplicationDto::from)
                .toList();
    }

    @Transactional
    public EvaluationDto create(EvaluationRequest request) {
        Application application = access.loadForManage(request.applicationId());
        if (!access.isEvaluable(application)) {
            throw new BusinessValidationException(
                    "Evaluations can only be recorded for accepted interns once the internship has started.");
        }
        UserPrincipal principal = currentUserService.principal();
        Evaluation evaluation = evaluationRepository.findByApplicationIdAndEvaluatorId(application.getId(), principal.id())
                .orElse(null);
        if (evaluation != null && !evaluation.isArchived()) {
            throw new ConflictException("You have already evaluated this student for this internship. Edit the existing evaluation instead.");
        }
        if (evaluation == null) {
            evaluation = new Evaluation();
            evaluation.setApplication(application);
            evaluation.setEvaluator(currentUserService.userReference());
        }
        evaluation.setArchived(false);
        apply(evaluation, request);
        evaluationRepository.saveAndFlush(evaluation);
        auditService.log(AuditAction.EVALUATION_SAVED, "Evaluation", evaluation.getId(),
                "Application " + application.getId() + ", overall " + request.overallRating());
        return mapper.toDto(evaluationRepository.findDetailedById(evaluation.getId()).orElseThrow());
    }

    @Transactional
    public EvaluationDto update(Long id, EvaluationRequest request) {
        Evaluation evaluation = findEditable(id);
        if (!evaluation.getApplication().getId().equals(request.applicationId())) {
            throw BusinessValidationException.forField("applicationId", "The application of an evaluation cannot be changed.");
        }
        if (evaluation.isArchived()) {
            throw new ConflictException("Archived evaluations cannot be edited.");
        }
        apply(evaluation, request);
        auditService.log(AuditAction.EVALUATION_SAVED, "Evaluation", id, "Updated, overall " + request.overallRating());
        return mapper.toDto(evaluation);
    }

    /** "Delete" archives the evaluation; archived evaluations are excluded from reports. */
    @Transactional
    public void archive(Long id) {
        Evaluation evaluation = findEditable(id);
        if (evaluation.isArchived()) {
            throw new ConflictException("This evaluation is already archived.");
        }
        evaluation.setArchived(true);
        auditService.log(AuditAction.EVALUATION_ARCHIVED, "Evaluation", id, null);
    }

    private Evaluation find(Long id) {
        return evaluationRepository.findDetailedById(id).orElseThrow(() -> NotFoundException.of("Evaluation", id));
    }

    /** The evaluator may edit their own evaluation; admins may edit any. */
    private Evaluation findEditable(Long id) {
        Evaluation evaluation = find(id);
        UserPrincipal principal = currentUserService.principal();
        boolean own = evaluation.getEvaluator().getId().equals(principal.id());
        if (!principal.isAdmin() && !(own && access.canManage(evaluation.getApplication(), principal))) {
            throw new ForbiddenException("You can only change evaluations that you recorded.");
        }
        return evaluation;
    }

    private static void apply(Evaluation e, EvaluationRequest r) {
        e.setTechnicalSkills(r.technicalSkills());
        e.setSoftSkills(r.softSkills());
        e.setPunctuality(r.punctuality());
        e.setResponsibility(r.responsibility());
        e.setTeamwork(r.teamwork());
        e.setLearningAbility(r.learningAbility());
        e.setOverallRating(r.overallRating());
        e.setComments(TextUtils.trimToNull(r.comments()));
    }
}
