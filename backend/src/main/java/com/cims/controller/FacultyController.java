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

import com.cims.dto.common.ApiResponse;
import com.cims.dto.common.OptionDto;
import com.cims.dto.common.PageResponse;
import com.cims.dto.faculty.FacultyDto;
import com.cims.dto.faculty.FacultyProfileRequest;
import com.cims.dto.faculty.FacultyRequest;
import com.cims.service.FacultyService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/faculty")
public class FacultyController {

    private final FacultyService facultyService;

    public FacultyController(FacultyService facultyService) {
        this.facultyService = facultyService;
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('FACULTY')")
    public ApiResponse<FacultyDto> me() {
        return ApiResponse.ok(facultyService.me());
    }

    @PutMapping("/me")
    @PreAuthorize("hasRole('FACULTY')")
    public ApiResponse<FacultyDto> updateMe(@Valid @RequestBody FacultyProfileRequest request) {
        return ApiResponse.ok("Profile updated.", facultyService.updateMe(request));
    }

    @GetMapping("/options")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<OptionDto>> options() {
        return ApiResponse.ok(facultyService.options());
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<FacultyDto>> list(@RequestParam(required = false) String q,
                                                      @RequestParam(required = false) String department,
                                                      @RequestParam(required = false) Boolean active,
                                                      @RequestParam(required = false) Integer page,
                                                      @RequestParam(required = false) Integer size,
                                                      @RequestParam(required = false) String sort) {
        return ApiResponse.ok(facultyService.search(q, department, active, page, size, sort));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public ApiResponse<FacultyDto> get(@PathVariable Long id) {
        return ApiResponse.ok(facultyService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<FacultyDto>> create(@Valid @RequestBody FacultyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Faculty account created.", facultyService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<FacultyDto> update(@PathVariable Long id, @Valid @RequestBody FacultyRequest request) {
        return ApiResponse.ok("Faculty updated.", facultyService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deactivate(@PathVariable Long id) {
        facultyService.deactivate(id);
        return ApiResponse.message("Faculty account deactivated.");
    }
}
