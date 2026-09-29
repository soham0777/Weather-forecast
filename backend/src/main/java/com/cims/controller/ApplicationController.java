package com.cims.controller;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.application.ApplicationDetailDto;
import com.cims.dto.application.ApplicationDto;
import com.cims.dto.application.ApplicationRequest;
import com.cims.dto.application.ApplicationStatusRequest;
import com.cims.dto.application.ApplicationUpdateRequest;
import com.cims.dto.common.ApiResponse;
import com.cims.dto.common.PageResponse;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.service.ApplicationService;
import com.cims.service.StudentService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping
    public ApiResponse<PageResponse<ApplicationDto>> list(@RequestParam(required = false) ApplicationStatus status,
                                                          @RequestParam(required = false) Long internshipId,
                                                          @RequestParam(required = false) Long companyId,
                                                          @RequestParam(required = false) String q,
                                                          @RequestParam(required = false) Integer page,
                                                          @RequestParam(required = false) Integer size,
                                                          @RequestParam(required = false) String sort) {
        return ApiResponse.ok(applicationService.search(
                new ApplicationService.SearchParams(status, internshipId, companyId, q, page, size, sort)));
    }

    @GetMapping("/{id}")
    public ApiResponse<ApplicationDetailDto> get(@PathVariable Long id) {
        return ApiResponse.ok(applicationService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<ApplicationDetailDto>> apply(@Valid @RequestBody ApplicationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Application submitted successfully.", applicationService.apply(request)));
    }

    /** Student edit of a pending application (cover letter / qualifications). */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<ApplicationDetailDto> update(@PathVariable Long id, @Valid @RequestBody ApplicationUpdateRequest request) {
        return ApiResponse.ok("Application updated.", applicationService.update(id, request));
    }

    /** Reviewer decision (faculty coordinator / admin). */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<ApplicationDetailDto> changeStatus(@PathVariable Long id,
                                                          @Valid @RequestBody ApplicationStatusRequest request) {
        return ApiResponse.ok("Application status changed to " + request.status() + ".",
                applicationService.changeStatus(id, request));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<ApplicationDetailDto> complete(@PathVariable Long id) {
        return ApiResponse.ok("Internship marked as completed.", applicationService.markCompleted(id));
    }

    /** Withdrawal: the record is kept with status WITHDRAWN (no physical delete). */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<ApplicationDetailDto> withdraw(@PathVariable Long id) {
        return ApiResponse.ok("Application withdrawn.", applicationService.withdraw(id));
    }

    @GetMapping("/{id}/resume")
    public ResponseEntity<Resource> resume(@PathVariable Long id) {
        StudentService.ResumeFile file = applicationService.resume(id);
        return FileResponses.pdf(file.resource(), file.fileName());
    }
}
