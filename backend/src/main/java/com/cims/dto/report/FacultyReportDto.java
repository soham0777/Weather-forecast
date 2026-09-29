package com.cims.dto.report;

import java.util.List;

import com.cims.dto.report.ReportCommon.InternshipApplications;
import com.cims.dto.report.ReportCommon.PerformanceAverages;
import com.cims.dto.report.ReportCommon.StatusCount;
import com.cims.dto.report.ReportCommon.StudentFeedbackAverages;

public record FacultyReportDto(PostedInternships postedInternships, ApplicationReview applicationReview,
                               StudentEvaluations studentEvaluations, InterviewStatistics interviewStatistics) {

    public record PostedInternships(long total, List<StatusCount> statusBreakdown,
                                    List<InternshipApplications> applicationsPerInternship) {
    }

    /** reviewed = shortlisted + accepted + rejected; shortlistingProgress = (shortlisted + accepted) / (total − withdrawn) × 100. */
    public record ApplicationReview(long totalApplications, long reviewed, long pending, long shortlisted, long accepted,
                                    long rejected, long withdrawn, Double shortlistingProgress) {
    }

    public record StudentEvaluations(long evaluatedStudents, PerformanceAverages evaluationAverages,
                                     PerformanceAverages companyFeedbackAverages, Double averageHireLikelihood,
                                     StudentFeedbackAverages studentFeedbackAverages) {
    }

    /** successRate = interviews with result SELECTED / completed interviews × 100. */
    public record InterviewStatistics(long scheduled, long completed, long cancelled, long selected, Double successRate) {
    }
}
