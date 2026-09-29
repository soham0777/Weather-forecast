package com.cims.dto.dashboard;

import java.util.List;

import com.cims.dto.internship.InternshipDto;
import com.cims.dto.report.ReportCommon.PeriodCount;
import com.cims.dto.report.ReportCommon.StatusCount;

public record AdminDashboardDto(long totalStudents, long activeStudents, long totalFaculty, long totalCompanies,
                                long totalInternships, long pendingApprovals, long totalApplications,
                                long pendingApplications, long scheduledInterviews, long totalInterviews,
                                long acceptedApplications, List<StatusCount> applicationStatus,
                                List<StatusCount> internshipStatus, List<PeriodCount> applicationsPerMonth,
                                List<InternshipDto> awaitingApproval) {
}
