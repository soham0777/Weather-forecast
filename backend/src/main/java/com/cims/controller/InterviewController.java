package com.cims.controller;

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

import com.cims.dto.common.ApiResponse;
import com.cims.dto.common.PageResponse;
import com.cims.dto.interview.InterviewDto;
import com.cims.dto.interview.InterviewRequest;
import com.cims.dto.interview.InterviewResultRequest;
import com.cims.dto.interview.InterviewUpdateRequest;
import com.cims.entity.enums.InterviewStatus;
import com.cims.service.InterviewService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/interviews")
public class InterviewController {

    private final InterviewService interviewService;

    public InterviewController(InterviewService interviewService) {
        this.interviewService = interviewService;
    }

    /** {@code scope=upcoming|past} filters by date; results are scoped to the caller's role. */
    @GetMapping
    public ApiResponse<PageResponse<InterviewDto>> list(@RequestParam(required = false) InterviewStatus status,
                                                        @RequestParam(required = false) String scope,
                                                        @RequestParam(required = false) Long applicationId,
                                                        @RequestParam(required = false) String q,
                                                        @RequestParam(required = false) Integer page,
                                                        @RequestParam(required = false) Integer size,
                                                        @RequestParam(required = false) String sort) {
        return ApiResponse.ok(interviewService.search(
                new InterviewService.SearchParams(status, scope, applicationId, q, page, size, sort)));
    }

    @GetMapping("/{id}")
    public ApiResponse<InterviewDto> get(@PathVariable Long id) {
        return ApiResponse.ok(interviewService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<InterviewDto>> schedule(@Valid @RequestBody InterviewRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Interview scheduled.", interviewService.schedule(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<InterviewDto> update(@PathVariable Long id, @Valid @RequestBody InterviewUpdateRequest request) {
        return ApiResponse.ok("Interview updated.", interviewService.update(id, request));
    }

    @PatchMapping("/{id}/result")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<InterviewDto> result(@PathVariable Long id, @Valid @RequestBody InterviewResultRequest request) {
        return ApiResponse.ok("Interview result recorded.", interviewService.recordResult(id, request));
    }

    /** Cancels the interview (status CANCELLED); the record is kept. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<InterviewDto> cancel(@PathVariable Long id, @RequestParam(required = false) String reason) {
        return ApiResponse.ok("Interview cancelled.", interviewService.cancel(id, reason));
    }
}
