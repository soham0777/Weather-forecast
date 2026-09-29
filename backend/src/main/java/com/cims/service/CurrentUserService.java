package com.cims.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.cims.entity.Faculty;
import com.cims.entity.Student;
import com.cims.entity.User;
import com.cims.exception.ApiException;
import com.cims.exception.NotFoundException;
import com.cims.repository.FacultyRepository;
import com.cims.repository.StudentRepository;
import com.cims.repository.UserRepository;
import com.cims.security.SecurityUtils;
import com.cims.security.UserPrincipal;

/** Resolves the authenticated user and their role-specific profile. */
@Service
public class CurrentUserService {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final FacultyRepository facultyRepository;

    public CurrentUserService(UserRepository userRepository, StudentRepository studentRepository,
                              FacultyRepository facultyRepository) {
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.facultyRepository = facultyRepository;
    }

    public UserPrincipal principal() {
        return SecurityUtils.currentPrincipal()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required. Please log in."));
    }

    public User user() {
        return userRepository.findById(principal().id())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Your account no longer exists."));
    }

    public User userReference() {
        return userRepository.getReferenceById(principal().id());
    }

    public Student student() {
        return studentRepository.findByUserId(principal().id())
                .orElseThrow(() -> new NotFoundException("Student profile not found for the current user."));
    }

    public Faculty faculty() {
        return facultyRepository.findByUserId(principal().id())
                .orElseThrow(() -> new NotFoundException("Faculty profile not found for the current user."));
    }
}
