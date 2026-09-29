package com.cims.dto.report;

import java.time.Instant;
import java.util.List;

import com.cims.dto.evaluation.EvaluationDto;
import com.cims.dto.feedback.CompanyFeedbackDto;
import com.cims.dto.interview.InterviewDto;
import com.cims.dto.report.ReportCommon.Offer;
import com.cims.dto.report.ReportCommon.StatusCount;

public record StudentReportDto(MyApplications applications, InterviewSchedule interviews, PlacementStatus placement,
                               List<EvaluationDto> evaluations, List<CompanyFeedbackDto> companyFeedback) {

    public record MyApplications(long total, List<StatusCount> statusDistribution, List<ApplicationTimelineItem> timeline) {
    }

    public record ApplicationTimelineItem(Long applicationId, String internshipTitle, String companyName, String status,
                                          Instant appliedAt, Instant lastUpdatedAt) {
    }

    public record InterviewSchedule(List<InterviewDto> upcoming, List<InterviewDto> past) {
    }

    /** {@code status}: PLACED when at least one application is ACCEPTED, otherwise NOT_PLACED. */
    public record PlacementStatus(String status, List<Offer> offers) {
    }
}
