package com.cims.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.common.ApiResponse;
import com.cims.dto.dashboard.AdminDashboardDto;
import com.cims.dto.dashboard.FacultyDashboardDto;
import com.cims.dto.dashboard.StudentDashboardDto;
import com.cims.service.DashboardService;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminDashboardDto> admin() {
        return ApiResponse.ok(dashboardService.admin());
    }

    @GetMapping("/faculty")
    @PreAuthorize("hasRole('FACULTY')")
    public ApiResponse<FacultyDashboardDto> faculty() {
        return ApiResponse.ok(dashboardService.faculty());
    }

    @GetMapping("/student")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<StudentDashboardDto> student() {
        return ApiResponse.ok(dashboardService.student());
    }
}
