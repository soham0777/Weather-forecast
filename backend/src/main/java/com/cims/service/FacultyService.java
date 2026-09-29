package com.cims.service;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.common.OptionDto;
import com.cims.dto.common.PageResponse;
import com.cims.dto.faculty.FacultyDto;
import com.cims.dto.faculty.FacultyProfileRequest;
import com.cims.dto.faculty.FacultyRequest;
import com.cims.entity.Faculty;
import com.cims.entity.User;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.Role;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.FacultyRepository;
import com.cims.repository.InternshipRepository;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;

@Service
public class FacultyService {

    private static final Map<String, String> SORT_KEYS = Map.of(
            "name", "name", "department", "department", "designation", "designation", "createdAt", "createdAt");

    private final FacultyRepository facultyRepository;
    private final InternshipRepository internshipRepository;
    private final UserAccountService userAccountService;
    private final EmailVerificationService emailVerificationService;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    public FacultyService(FacultyRepository facultyRepository, InternshipRepository internshipRepository,
                          UserAccountService userAccountService, EmailVerificationService emailVerificationService,
                          CurrentUserService currentUserService, AuditService auditService) {
        this.facultyRepository = facultyRepository;
        this.internshipRepository = internshipRepository;
        this.userAccountService = userAccountService;
        this.emailVerificationService = emailVerificationService;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResponse<FacultyDto> search(String q, String department, Boolean active, Integer page, Integer size,
                                           String sort) {
        var pageable = PageUtils.of(page, size, sort, SORT_KEYS, Sort.by("name"));
        return PageResponse.of(facultyRepository.search(TextUtils.likePattern(q), TextUtils.trimToNull(department),
                active, pageable), this::toDto);
    }

    @Transactional(readOnly = true)
    public FacultyDto get(Long id) {
        Faculty faculty = find(id);
        UserPrincipal principal = currentUserService.principal();
        if (!principal.isAdmin() && !faculty.getUser().getId().equals(principal.id())) {
            throw new ForbiddenException("You do not have access to this faculty record.");
        }
        return toDto(faculty);
    }

    @Transactional(readOnly = true)
    public FacultyDto me() {
        return toDto(currentUserService.faculty());
    }

    @Transactional
    public FacultyDto updateMe(FacultyProfileRequest request) {
        Faculty faculty = currentUserService.faculty();
        apply(faculty, request.name(), request.department(), request.designation(), request.phone());
        auditService.log(AuditAction.PROFILE_UPDATED, "Faculty", faculty.getId(), "Profile updated by faculty");
        return toDto(faculty);
    }

    @Transactional
    public FacultyDto create(FacultyRequest request) {
        if (request.password() == null || request.password().isBlank()) {
            throw BusinessValidationException.forField("password", "An initial password is required.");
        }
        User user = userAccountService.createUser(request.email(), request.password(), Role.FACULTY, false);
        Faculty faculty = new Faculty();
        faculty.setUser(user);
        apply(faculty, request.name(), request.department(), request.designation(), request.phone());
        facultyRepository.save(faculty);
        auditService.log(AuditAction.USER_CREATED, "Faculty", faculty.getId(), "Faculty account " + user.getEmail());
        emailVerificationService.sendVerification(user, faculty.getName());
        return toDto(faculty);
    }

    @Transactional
    public FacultyDto update(Long id, FacultyRequest request) {
        Faculty faculty = find(id);
        userAccountService.changeEmail(faculty.getUser(), request.email());
        apply(faculty, request.name(), request.department(), request.designation(), request.phone());
        auditService.log(AuditAction.PROFILE_UPDATED, "Faculty", faculty.getId(), "Faculty record updated by admin");
        return toDto(faculty);
    }

    @Transactional
    public void deactivate(Long id) {
        Faculty faculty = find(id);
        userAccountService.setActive(faculty.getUser().getId(), false);
    }

    /** Active faculty members for drop-downs (e.g. when an admin assigns an internship coordinator). */
    @Transactional(readOnly = true)
    public List<OptionDto> options() {
        return facultyRepository.findAllActive().stream()
                .map(f -> new OptionDto(f.getId(), f.getName() + " (" + f.getDepartment() + ")"))
                .toList();
    }

    private Faculty find(Long id) {
        return facultyRepository.findWithUserById(id).orElseThrow(() -> NotFoundException.of("Faculty member", id));
    }

    private FacultyDto toDto(Faculty faculty) {
        return FacultyDto.from(faculty, internshipRepository.countByFacultyId(faculty.getId()));
    }

    private static void apply(Faculty faculty, String name, String department, String designation, String phone) {
        faculty.setName(name.trim());
        faculty.setDepartment(department.trim());
        faculty.setDesignation(designation.trim());
        faculty.setPhone(phone.trim());
    }
}
