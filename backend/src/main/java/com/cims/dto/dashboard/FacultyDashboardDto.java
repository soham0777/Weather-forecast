package com.cims.dto.dashboard;

import java.util.List;

import com.cims.dto.application.ApplicationDto;
import com.cims.dto.interview.InterviewDto;
import com.cims.dto.report.ReportCommon.StatusCount;

public record FacultyDashboardDto(long postedInternships, long pendingApproval, long openInternships,
                                  long applications, long pendingReviews, long shortlistedStudents,
                                  long scheduledInterviews, long evaluations, long pendingEvaluations,
                                  List<StatusCount> applicationStatus, List<InterviewDto> upcomingInterviews,
                                  List<ApplicationDto> recentApplications) {
}
