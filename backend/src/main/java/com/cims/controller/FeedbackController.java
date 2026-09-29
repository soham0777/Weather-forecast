package com.cims.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.common.ApiResponse;
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
import com.cims.entity.enums.SystemFeedbackStatus;
import com.cims.entity.enums.SystemFeedbackType;
import com.cims.service.FeedbackService;

import jakarta.validation.Valid;

/** Feedback endpoints, one sub-resource per feedback category. */
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    // ---------- student → company

    @GetMapping("/student")
    public ApiResponse<PageResponse<StudentFeedbackDto>> studentFeedback(@RequestParam(required = false) Long companyId,
                                                                         @RequestParam(required = false) Integer page,
                                                                         @RequestParam(required = false) Integer size,
                                                                         @RequestParam(required = false) String sort) {
        return ApiResponse.ok(feedbackService.searchStudentFeedback(companyId, page, size, sort));
    }

    @PostMapping("/student")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentFeedbackDto>> createStudentFeedback(@Valid @RequestBody StudentFeedbackRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Thank you for your feedback.", feedbackService.createStudentFeedback(request)));
    }

    @PutMapping("/student/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<StudentFeedbackDto> updateStudentFeedback(@PathVariable Long id,
                                                                 @Valid @RequestBody StudentFeedbackRequest request) {
        return ApiResponse.ok("Feedback updated.", feedbackService.updateStudentFeedback(id, request));
    }

    // ---------- company → student

    @GetMapping("/company")
    public ApiResponse<PageResponse<CompanyFeedbackDto>> companyFeedback(@RequestParam(required = false) Long companyId,
                                                                         @RequestParam(required = false) Integer page,
                                                                         @RequestParam(required = false) Integer size,
                                                                         @RequestParam(required = false) String sort) {
        return ApiResponse.ok(feedbackService.searchCompanyFeedback(companyId, page, size, sort));
    }

    @PostMapping("/company")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<CompanyFeedbackDto>> createCompanyFeedback(@Valid @RequestBody CompanyFeedbackRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Company feedback recorded.", feedbackService.createCompanyFeedback(request)));
    }

    @PutMapping("/company/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<CompanyFeedbackDto> updateCompanyFeedback(@PathVariable Long id,
                                                                 @Valid @RequestBody CompanyFeedbackRequest request) {
        return ApiResponse.ok("Company feedback updated.", feedbackService.updateCompanyFeedback(id, request));
    }

    // ---------- faculty → internship

    @GetMapping("/faculty")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<PageResponse<FacultyFeedbackDto>> facultyFeedback(@RequestParam(required = false) Long internshipId,
                                                                         @RequestParam(required = false) Integer page,
                                                                         @RequestParam(required = false) Integer size,
                                                                         @RequestParam(required = false) String sort) {
        return ApiResponse.ok(feedbackService.searchFacultyFeedback(internshipId, page, size, sort));
    }

    @PostMapping("/faculty")
    @PreAuthorize("hasRole('FACULTY')")
    public ResponseEntity<ApiResponse<FacultyFeedbackDto>> createFacultyFeedback(@Valid @RequestBody FacultyFeedbackRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Feedback saved.", feedbackService.createFacultyFeedback(request)));
    }

    @PutMapping("/faculty/{id}")
    @PreAuthorize("hasRole('FACULTY')")
    public ApiResponse<FacultyFeedbackDto> updateFacultyFeedback(@PathVariable Long id,
                                                                 @Valid @RequestBody FacultyFeedbackRequest request) {
        return ApiResponse.ok("Feedback updated.", feedbackService.updateFacultyFeedback(id, request));
    }

    // ---------- system (platform) feedback

    @GetMapping("/system")
    public ApiResponse<PageResponse<SystemFeedbackDto>> systemFeedback(@RequestParam(required = false) SystemFeedbackType type,
                                                                       @RequestParam(required = false) SystemFeedbackStatus status,
                                                                       @RequestParam(required = false) String q,
                                                                       @RequestParam(required = false) Integer page,
                                                                       @RequestParam(required = false) Integer size,
                                                                       @RequestParam(required = false) String sort) {
        return ApiResponse.ok(feedbackService.searchSystemFeedback(type, status, q, page, size, sort));
    }

    @PostMapping("/system")
    public ResponseEntity<ApiResponse<SystemFeedbackDto>> createSystemFeedback(@Valid @RequestBody SystemFeedbackRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Thank you! Your feedback has been submitted.", feedbackService.createSystemFeedback(request)));
    }

    @PutMapping("/system/{id}")
    public ApiResponse<SystemFeedbackDto> updateSystemFeedback(@PathVariable Long id,
                                                               @Valid @RequestBody SystemFeedbackRequest request) {
        return ApiResponse.ok("Feedback updated.", feedbackService.updateSystemFeedback(id, request));
    }

    @PatchMapping("/system/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<SystemFeedbackDto> updateSystemFeedbackStatus(@PathVariable Long id,
                                                                     @Valid @RequestBody SystemFeedbackStatusRequest request) {
        return ApiResponse.ok("Feedback status updated.", feedbackService.updateSystemFeedbackStatus(id, request));
    }
}
