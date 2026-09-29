package com.cims.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

import org.springframework.core.io.Resource;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.cims.dto.common.PageResponse;
import com.cims.dto.student.AdminStudentRequest;
import com.cims.dto.student.StudentDto;
import com.cims.dto.student.StudentProfileDto;
import com.cims.dto.student.StudentUpdateRequest;
import com.cims.entity.Student;
import com.cims.entity.User;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.Role;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ForbiddenException;
import com.cims.exception.NotFoundException;
import com.cims.repository.ApplicationRepository;
import com.cims.repository.StudentRepository;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;
import com.cims.util.TransactionUtils;

@Service
public class StudentService {

    private static final Map<String, String> SORT_KEYS = Map.of(
            "name", "studentName", "department", "department", "gpa", "gpa", "createdAt", "createdAt");

    private final StudentRepository studentRepository;
    private final ApplicationRepository applicationRepository;
    private final UserAccountService userAccountService;
    private final EmailVerificationService emailVerificationService;
    private final FileStorageService fileStorageService;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    public StudentService(StudentRepository studentRepository, ApplicationRepository applicationRepository,
                          UserAccountService userAccountService, EmailVerificationService emailVerificationService,
                          FileStorageService fileStorageService, CurrentUserService currentUserService,
                          AuditService auditService) {
        this.studentRepository = studentRepository;
        this.applicationRepository = applicationRepository;
        this.userAccountService = userAccountService;
        this.emailVerificationService = emailVerificationService;
        this.fileStorageService = fileStorageService;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
    }

    // ------------------------------------------------------------------ self service

    @Transactional(readOnly = true)
    public StudentProfileDto myProfile() {
        return toProfile(currentUserService.student());
    }

    @Transactional
    public StudentProfileDto updateMyProfile(StudentUpdateRequest request) {
        Student student = currentUserService.student();
        applyProfile(student, request.name(), request.phone(), request.department(), request.gpa());
        auditService.log(AuditAction.PROFILE_UPDATED, "Student", student.getId(), "Profile updated by student");
        return toProfile(student);
    }

    @Transactional
    public StudentProfileDto uploadMyResume(MultipartFile file) {
        Student student = currentUserService.student();
        String previous = student.getResumePath();
        String key = fileStorageService.storeResume(file);
        student.setResumePath(key);
        student.setResumeOriginalName(sanitizeFileName(file.getOriginalFilename()));
        student.setResumeUploadedAt(Instant.now());
        // Submitted applications keep their own snapshot copy, so the old profile file can go.
        // Only files uploaded through the app (under resumes/) are removed.
        if (previous != null && previous.startsWith(FileStorageService.RESUME_PREFIX)) {
            TransactionUtils.afterCommit(() -> fileStorageService.deleteQuietly(previous));
        }
        return toProfile(student);
    }

    @Transactional(readOnly = true)
    public ResumeFile myResume() {
        return resumeOf(currentUserService.student());
    }

    // ------------------------------------------------------------------ administration

    @Transactional(readOnly = true)
    public PageResponse<StudentDto> search(String q, String department, Boolean active, Integer page, Integer size,
                                           String sort) {
        var pageable = PageUtils.of(page, size, sort, SORT_KEYS, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(studentRepository.search(TextUtils.likePattern(q), TextUtils.trimToNull(department),
                active, pageable), StudentDto::from);
    }

    @Transactional(readOnly = true)
    public StudentProfileDto get(Long id) {
        Student student = findStudent(id);
        assertCanView(student);
        return toProfile(student);
    }

    @Transactional
    public StudentProfileDto create(AdminStudentRequest request) {
        if (request.password() == null || request.password().isBlank()) {
            throw BusinessValidationException.forField("password", "An initial password is required.");
        }
        User user = userAccountService.createUser(request.email(), request.password(), Role.STUDENT, false);
        Student student = new Student();
        student.setUser(user);
        applyProfile(student, request.name(), request.phone(), request.department(), request.gpa());
        studentRepository.save(student);
        auditService.log(AuditAction.USER_CREATED, "Student", student.getId(), "Student account " + user.getEmail());
        emailVerificationService.sendVerification(user, student.getStudentName());
        return toProfile(student);
    }

    @Transactional
    public StudentProfileDto update(Long id, AdminStudentRequest request) {
        Student student = findStudent(id);
        userAccountService.changeEmail(student.getUser(), request.email());
        applyProfile(student, request.name(), request.phone(), request.department(), request.gpa());
        auditService.log(AuditAction.PROFILE_UPDATED, "Student", student.getId(), "Student record updated");
        return toProfile(student);
    }

    /** "Delete" never removes the record: the account is deactivated (is_active = false). */
    @Transactional
    public void deactivate(Long id) {
        Student student = findStudent(id);
        userAccountService.setActive(student.getUser().getId(), false);
    }

    @Transactional(readOnly = true)
    public ResumeFile resumeOf(Long studentId) {
        Student student = findStudent(studentId);
        assertCanView(student);
        return resumeOf(student);
    }

    // ------------------------------------------------------------------ helpers

    private ResumeFile resumeOf(Student student) {
        if (student.getResumePath() == null) {
            throw new NotFoundException("No resume has been uploaded yet.");
        }
        String name = student.getResumeOriginalName() != null ? student.getResumeOriginalName() : "resume.pdf";
        return new ResumeFile(fileStorageService.load(student.getResumePath()), name);
    }

    private Student findStudent(Long id) {
        return studentRepository.findWithUserById(id).orElseThrow(() -> NotFoundException.of("Student", id));
    }

    /** Admins see everyone; faculty only students who applied to their internships; students only themselves. */
    private void assertCanView(Student student) {
        UserPrincipal principal = currentUserService.principal();
        if (principal.isAdmin()) {
            return;
        }
        if (principal.isStudent() && student.getUser().getId().equals(principal.id())) {
            return;
        }
        if (principal.isFaculty()
                && applicationRepository.existsForStudentAndFaculty(student.getId(), currentUserService.faculty().getId())) {
            return;
        }
        throw new ForbiddenException("You do not have access to this student's record.");
    }

    private static void applyProfile(Student student, String name, String phone, String department, BigDecimal gpa) {
        student.setStudentName(name.trim());
        student.setPhone(phone.trim());
        student.setDepartment(department.trim());
        student.setGpa(gpa);
    }

    StudentProfileDto toProfile(Student student) {
        User user = student.getUser();
        Long id = student.getId();
        var stats = new StudentProfileDto.ApplicationStats(
                applicationRepository.countByStudentId(id),
                applicationRepository.countByStudentIdAndStatus(id, ApplicationStatus.PENDING),
                applicationRepository.countByStudentIdAndStatus(id, ApplicationStatus.SHORTLISTED),
                applicationRepository.countByStudentIdAndStatus(id, ApplicationStatus.ACCEPTED),
                applicationRepository.countByStudentIdAndStatus(id, ApplicationStatus.REJECTED),
                applicationRepository.countByStudentIdAndStatus(id, ApplicationStatus.WITHDRAWN));
        var resume = new StudentProfileDto.ResumeInfo(student.getResumePath() != null,
                student.getResumeOriginalName(), student.getResumeUploadedAt());
        return new StudentProfileDto(id, user.getId(), student.getStudentName(), user.getEmail(), student.getPhone(),
                student.getDepartment(), student.getGpa(), user.isActive(), user.isVerified(), resume, stats,
                profileCompletion(student), student.getCreatedAt(), student.getUpdatedAt());
    }

    /** Percentage of the six profile items that are complete (4 mandatory fields, resume, verified e-mail). */
    static int profileCompletion(Student student) {
        int done = 0;
        done += student.getStudentName() != null ? 1 : 0;
        done += student.getPhone() != null ? 1 : 0;
        done += student.getDepartment() != null ? 1 : 0;
        done += student.getGpa() != null ? 1 : 0;
        done += student.getResumePath() != null ? 1 : 0;
        done += student.getUser().isVerified() ? 1 : 0;
        return Math.round(done * 100f / 6);
    }

    private static String sanitizeFileName(String name) {
        if (name == null || name.isBlank()) {
            return "resume.pdf";
        }
        String base = name.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_");
        return base.length() > 200 ? base.substring(base.length() - 200) : base;
    }

    public record ResumeFile(Resource resource, String fileName) {
    }
}
