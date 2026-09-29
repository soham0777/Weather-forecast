package com.cims.service;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.auth.AuthResponse;
import com.cims.dto.auth.ChangePasswordRequest;
import com.cims.dto.auth.CurrentUserDto;
import com.cims.dto.auth.LoginRequest;
import com.cims.dto.auth.RegisterRequest;
import com.cims.entity.Student;
import com.cims.entity.User;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.Role;
import com.cims.exception.ApiException;
import com.cims.exception.BusinessValidationException;
import com.cims.exception.ConflictException;
import com.cims.exception.ForbiddenException;
import com.cims.repository.StudentRepository;
import com.cims.repository.UserRepository;
import com.cims.security.JwtService;
import com.cims.util.TextUtils;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final UserAccountService userAccountService;
    private final EmailVerificationService emailVerificationService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    /** Hash compared against when the e-mail is unknown, so response time does not reveal accounts. */
    private final String dummyHash;

    public AuthService(UserRepository userRepository, StudentRepository studentRepository,
                       UserAccountService userAccountService, EmailVerificationService emailVerificationService,
                       PasswordEncoder passwordEncoder, JwtService jwtService, AuditService auditService,
                       CurrentUserService currentUserService) {
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.userAccountService = userAccountService;
        this.emailVerificationService = emailVerificationService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.dummyHash = passwordEncoder.encode(java.util.UUID.randomUUID().toString());
    }

    /** Student self-registration. Returns a token so the student is signed in immediately. */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        User user = userAccountService.createUser(request.email(), request.password(), Role.STUDENT, false);

        Student student = new Student();
        student.setUser(user);
        student.setStudentName(request.name().trim());
        student.setPhone(request.phone().trim());
        student.setDepartment(request.department().trim());
        student.setGpa(request.gpa());
        studentRepository.save(student);

        user.setLastLoginAt(Instant.now());
        auditService.logForUser(user.getId(), AuditAction.USER_REGISTERED, "Student", student.getId(), user.getEmail());
        emailVerificationService.sendVerification(user, student.getStudentName());

        JwtService.IssuedToken token = jwtService.generate(user);
        return AuthResponse.bearer(token.token(), token.expiresAt(), userAccountService.toCurrentUserDto(user));
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse login(LoginRequest request) {
        String email = TextUtils.normalizeEmail(request.email());
        User user = userRepository.findByEmail(email).orElse(null);
        String hash = user != null ? user.getPasswordHash() : dummyHash;
        boolean passwordMatches = passwordEncoder.matches(request.password(), hash);

        if (user == null || !passwordMatches) {
            auditService.logViolation(AuditAction.LOGIN_FAILED, "User", user != null ? user.getId() : null,
                    "Failed login for " + email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid e-mail or password.");
        }
        if (!user.isActive()) {
            auditService.logViolation(AuditAction.LOGIN_FAILED, "User", user.getId(), "Login attempt on deactivated account");
            throw new ForbiddenException("Your account has been deactivated. Please contact the administrator.");
        }

        user.setLastLoginAt(Instant.now());
        auditService.logForUser(user.getId(), AuditAction.LOGIN_SUCCESS, "User", user.getId(), null);
        JwtService.IssuedToken token = jwtService.generate(user);
        return AuthResponse.bearer(token.token(), token.expiresAt(), userAccountService.toCurrentUserDto(user));
    }

    @Transactional
    public void logout() {
        auditService.log(AuditAction.LOGOUT, "User", currentUserService.principal().id(), null);
    }

    @Transactional(readOnly = true)
    public CurrentUserDto me() {
        return userAccountService.toCurrentUserDto(currentUserService.user());
    }

    @Transactional
    public void verifyEmail(String token) {
        emailVerificationService.verify(token);
    }

    @Transactional
    public void resendVerification() {
        User user = currentUserService.user();
        if (user.isVerified()) {
            throw new ConflictException("Your e-mail address is already verified.");
        }
        CurrentUserDto dto = userAccountService.toCurrentUserDto(user);
        emailVerificationService.sendVerification(user, dto.name() != null ? dto.name() : user.getEmail());
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        User user = currentUserService.user();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw BusinessValidationException.forField("currentPassword", "Current password is incorrect.");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw BusinessValidationException.forField("newPassword", "New password must be different from the current password.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        auditService.log(AuditAction.PASSWORD_CHANGED, "User", user.getId(), null);
    }
}
