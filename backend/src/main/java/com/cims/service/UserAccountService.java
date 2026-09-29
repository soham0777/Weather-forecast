package com.cims.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.auth.CurrentUserDto;
import com.cims.entity.User;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.Role;
import com.cims.exception.BadRequestException;
import com.cims.exception.ConflictException;
import com.cims.exception.NotFoundException;
import com.cims.repository.FacultyRepository;
import com.cims.repository.StudentRepository;
import com.cims.repository.UserRepository;
import com.cims.util.TextUtils;

/** Account-level operations shared by registration and user administration. */
@Service
public class UserAccountService {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final FacultyRepository facultyRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;

    public UserAccountService(UserRepository userRepository, StudentRepository studentRepository,
                              FacultyRepository facultyRepository, PasswordEncoder passwordEncoder,
                              AuditService auditService, CurrentUserService currentUserService) {
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.facultyRepository = facultyRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
    }

    /** Creates a login account after checking e-mail uniqueness. The password is BCrypt-hashed. */
    @Transactional
    public User createUser(String email, String rawPassword, Role role, boolean verified) {
        String normalized = TextUtils.normalizeEmail(email);
        if (userRepository.existsByEmail(normalized)) {
            throw new ConflictException("An account with this e-mail address already exists.");
        }
        User user = new User();
        user.setEmail(normalized);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(role);
        user.setActive(true);
        user.setVerified(verified);
        return userRepository.save(user);
    }

    /** Changes the e-mail of an existing account (admin/self profile edits). */
    @Transactional
    public void changeEmail(User user, String newEmail) {
        String normalized = TextUtils.normalizeEmail(newEmail);
        if (normalized.equals(user.getEmail())) {
            return;
        }
        if (userRepository.existsByEmail(normalized)) {
            throw new ConflictException("An account with this e-mail address already exists.");
        }
        user.setEmail(normalized);
        user.setVerified(false);
    }

    /** Activates or deactivates an account (admin only). Deactivated users cannot log in. */
    @Transactional
    public CurrentUserDto setActive(Long userId, boolean active) {
        User user = userRepository.findById(userId).orElseThrow(() -> NotFoundException.of("User", userId));
        if (user.getId().equals(currentUserService.principal().id()) && !active) {
            throw new BadRequestException("You cannot deactivate your own account.");
        }
        if (user.isActive() != active) {
            user.setActive(active);
            auditService.log(active ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED, "User", user.getId(),
                    user.getRole() + " " + user.getEmail());
        }
        return toCurrentUserDto(user);
    }

    /** Marks an account's e-mail as verified (admin override, e.g. when SMTP is unavailable). */
    @Transactional
    public CurrentUserDto markVerified(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> NotFoundException.of("User", userId));
        if (!user.isVerified()) {
            user.setVerified(true);
            auditService.log(AuditAction.USER_VERIFIED_BY_ADMIN, "User", user.getId(), user.getEmail());
        }
        return toCurrentUserDto(user);
    }

    @Transactional(readOnly = true)
    public CurrentUserDto toCurrentUserDto(User user) {
        String name = null;
        Long profileId = null;
        if (user.getRole() == Role.STUDENT) {
            var student = studentRepository.findByUserId(user.getId()).orElse(null);
            if (student != null) {
                name = student.getStudentName();
                profileId = student.getId();
            }
        } else if (user.getRole() == Role.FACULTY) {
            var faculty = facultyRepository.findByUserId(user.getId()).orElse(null);
            if (faculty != null) {
                name = faculty.getName();
                profileId = faculty.getId();
            }
        } else {
            name = "Administrator";
        }
        return new CurrentUserDto(user.getId(), user.getEmail(), user.getRole(), name, profileId,
                user.isActive(), user.isVerified(), user.getLastLoginAt());
    }
}
