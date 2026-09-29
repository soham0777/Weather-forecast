package com.cims.controller;

import java.math.BigDecimal;

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
import com.cims.dto.internship.InternshipDto;
import com.cims.dto.internship.InternshipFilterOptions;
import com.cims.dto.internship.InternshipRequest;
import com.cims.dto.internship.InternshipStatusRequest;
import com.cims.entity.enums.InternshipStatus;
import com.cims.service.InternshipService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/internships")
public class InternshipController {

    private final InternshipService internshipService;

    public InternshipController(InternshipService internshipService) {
        this.internshipService = internshipService;
    }

    /**
     * Search with server-side filtering and pagination. Students only receive APPROVED/OPEN
     * internships; faculty only their own; admins everything.
     */
    @GetMapping
    public ApiResponse<PageResponse<InternshipDto>> search(@RequestParam(required = false) String q,
                                                           @RequestParam(required = false) String domain,
                                                           @RequestParam(required = false) Long companyId,
                                                           @RequestParam(required = false) String location,
                                                           @RequestParam(required = false) BigDecimal minStipend,
                                                           @RequestParam(required = false) BigDecimal maxStipend,
                                                           @RequestParam(required = false) InternshipStatus status,
                                                           @RequestParam(required = false) Long facultyId,
                                                           @RequestParam(required = false) Integer page,
                                                           @RequestParam(required = false) Integer size,
                                                           @RequestParam(required = false) String sort) {
        return ApiResponse.ok(internshipService.search(new InternshipService.SearchParams(q, domain, companyId, location,
                minStipend, maxStipend, status, facultyId, page, size, sort)));
    }

    @GetMapping("/filters")
    public ApiResponse<InternshipFilterOptions> filters() {
        return ApiResponse.ok(internshipService.filterOptions());
    }

    @GetMapping("/{id}")
    public ApiResponse<InternshipDto> get(@PathVariable Long id) {
        return ApiResponse.ok(internshipService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<InternshipDto>> create(@Valid @RequestBody InternshipRequest request) {
        InternshipDto created = internshipService.create(request);
        String message = created.status() == InternshipStatus.PENDING
                ? "Internship submitted for admin approval." : "Internship created.";
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(message, created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<InternshipDto> update(@PathVariable Long id, @Valid @RequestBody InternshipRequest request) {
        return ApiResponse.ok("Internship updated.", internshipService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<InternshipDto> changeStatus(@PathVariable Long id, @Valid @RequestBody InternshipStatusRequest request) {
        return ApiResponse.ok("Internship status changed to " + request.status() + ".", internshipService.changeStatus(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        boolean deleted = internshipService.delete(id);
        return ApiResponse.message(deleted ? "Internship deleted." : "Internship archived.");
    }
}
