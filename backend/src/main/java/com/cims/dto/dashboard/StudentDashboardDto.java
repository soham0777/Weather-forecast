package com.cims.dto.dashboard;

import java.util.List;

import com.cims.dto.application.ApplicationDto;
import com.cims.dto.interview.InterviewDto;

public record StudentDashboardDto(int profileCompletion, boolean resumeUploaded, boolean emailVerified,
                                  long availableInternships, long applications, long pendingApplications,
                                  long shortlistedApplications, long acceptedApplications, long upcomingInterviewCount,
                                  List<InterviewDto> upcomingInterviews, List<ApplicationDto> recentApplications) {
}
