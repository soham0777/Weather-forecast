package com.cims.controller;

import java.util.List;

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
import com.cims.dto.common.OptionDto;
import com.cims.dto.common.PageResponse;
import com.cims.dto.company.CompanyDetailDto;
import com.cims.dto.company.CompanyDto;
import com.cims.dto.company.CompanyRequest;
import com.cims.entity.enums.CompanyStatus;
import com.cims.service.CompanyService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {

    private final CompanyService companyService;

    public CompanyController(CompanyService companyService) {
        this.companyService = companyService;
    }

    @GetMapping
    public ApiResponse<PageResponse<CompanyDto>> list(@RequestParam(required = false) String q,
                                                      @RequestParam(required = false) String location,
                                                      @RequestParam(required = false) CompanyStatus status,
                                                      @RequestParam(required = false) Integer page,
                                                      @RequestParam(required = false) Integer size,
                                                      @RequestParam(required = false) String sort) {
        return ApiResponse.ok(companyService.search(q, location, status, page, size, sort));
    }

    /** Active companies for drop-downs (internship forms). */
    @GetMapping("/options")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<List<OptionDto>> options() {
        return ApiResponse.ok(companyService.activeOptions());
    }

    @GetMapping("/{id}")
    public ApiResponse<CompanyDetailDto> get(@PathVariable Long id) {
        return ApiResponse.ok(companyService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CompanyDto>> create(@Valid @RequestBody CompanyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Company created.", companyService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CompanyDto> update(@PathVariable Long id, @Valid @RequestBody CompanyRequest request) {
        return ApiResponse.ok("Company updated.", companyService.update(id, request));
    }

    /** Archives the company (or deletes it if it has never had internships). */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        boolean deleted = companyService.delete(id);
        return ApiResponse.message(deleted ? "Company deleted." : "Company archived.");
    }

    @PatchMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CompanyDto> restore(@PathVariable Long id) {
        return ApiResponse.ok("Company restored.", companyService.restore(id));
    }
}
