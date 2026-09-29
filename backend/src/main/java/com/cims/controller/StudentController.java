package com.cims.controller;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.cims.dto.common.ApiResponse;
import com.cims.dto.common.PageResponse;
import com.cims.dto.student.AdminStudentRequest;
import com.cims.dto.student.StudentDto;
import com.cims.dto.student.StudentProfileDto;
import com.cims.dto.student.StudentUpdateRequest;
import com.cims.service.StudentService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    // ---------- current student

    @GetMapping("/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<StudentProfileDto> me() {
        return ApiResponse.ok(studentService.myProfile());
    }

    @PutMapping("/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<StudentProfileDto> updateMe(@Valid @RequestBody StudentUpdateRequest request) {
        return ApiResponse.ok("Profile updated.", studentService.updateMyProfile(request));
    }

    @PostMapping(value = "/me/resume", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<StudentProfileDto> uploadResume(@RequestPart("file") MultipartFile file) {
        return ApiResponse.ok("Resume uploaded.", studentService.uploadMyResume(file));
    }

    @GetMapping("/me/resume")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Resource> myResume() {
        StudentService.ResumeFile file = studentService.myResume();
        return FileResponses.pdf(file.resource(), file.fileName());
    }

    // ---------- administration

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<StudentDto>> list(@RequestParam(required = false) String q,
                                                      @RequestParam(required = false) String department,
                                                      @RequestParam(required = false) Boolean active,
                                                      @RequestParam(required = false) Integer page,
                                                      @RequestParam(required = false) Integer size,
                                                      @RequestParam(required = false) String sort) {
        return ApiResponse.ok(studentService.search(q, department, active, page, size, sort));
    }

    @GetMapping("/{id}")
    public ApiResponse<StudentProfileDto> get(@PathVariable Long id) {
        return ApiResponse.ok(studentService.get(id));
    }

    @GetMapping("/{id}/resume")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ResponseEntity<Resource> resume(@PathVariable Long id) {
        StudentService.ResumeFile file = studentService.resumeOf(id);
        return FileResponses.pdf(file.resource(), file.fileName());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<StudentProfileDto>> create(@Valid @RequestBody AdminStudentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Student created.", studentService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<StudentProfileDto> update(@PathVariable Long id, @Valid @RequestBody AdminStudentRequest request) {
        return ApiResponse.ok("Student updated.", studentService.update(id, request));
    }

    /** Soft delete: deactivates the student's account. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deactivate(@PathVariable Long id) {
        studentService.deactivate(id);
        return ApiResponse.message("Student account deactivated.");
    }
}
