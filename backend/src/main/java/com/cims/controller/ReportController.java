package com.cims.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.common.ApiResponse;
import com.cims.dto.report.AdminReportDto;
import com.cims.dto.report.FacultyReportDto;
import com.cims.dto.report.StudentReportDto;
import com.cims.service.ReportService;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminReportDto> admin() {
        return ApiResponse.ok(reportService.adminReport());
    }

    @GetMapping("/faculty")
    @PreAuthorize("hasRole('FACULTY')")
    public ApiResponse<FacultyReportDto> faculty() {
        return ApiResponse.ok(reportService.facultyReport());
    }

    @GetMapping("/student")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<StudentReportDto> student() {
        return ApiResponse.ok(reportService.studentReport());
    }
}
