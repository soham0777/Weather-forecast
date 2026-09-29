package com.cims.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.application.ApplicationDto;
import com.cims.dto.common.ApiResponse;
import com.cims.dto.common.PageResponse;
import com.cims.dto.evaluation.EvaluationDto;
import com.cims.dto.evaluation.EvaluationRequest;
import com.cims.service.EvaluationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/evaluations")
public class EvaluationController {

    private final EvaluationService evaluationService;

    public EvaluationController(EvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @GetMapping
    public ApiResponse<PageResponse<EvaluationDto>> list(@RequestParam(required = false) Long internshipId,
                                                         @RequestParam(defaultValue = "false") boolean includeArchived,
                                                         @RequestParam(required = false) String q,
                                                         @RequestParam(required = false) Integer page,
                                                         @RequestParam(required = false) Integer size,
                                                         @RequestParam(required = false) String sort) {
        return ApiResponse.ok(evaluationService.search(internshipId, includeArchived, q, page, size, sort));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<List<ApplicationDto>> pending() {
        return ApiResponse.ok(evaluationService.pending());
    }

    @GetMapping("/{id}")
    public ApiResponse<EvaluationDto> get(@PathVariable Long id) {
        return ApiResponse.ok(evaluationService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<EvaluationDto>> create(@Valid @RequestBody EvaluationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Evaluation saved.", evaluationService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<EvaluationDto> update(@PathVariable Long id, @Valid @RequestBody EvaluationRequest request) {
        return ApiResponse.ok("Evaluation updated.", evaluationService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<Void> archive(@PathVariable Long id) {
        evaluationService.archive(id);
        return ApiResponse.message("Evaluation archived.");
    }
}
