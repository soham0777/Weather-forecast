package com.cims.dto.report;

import java.math.BigDecimal;
import java.util.List;

import com.cims.dto.report.ReportCommon.ActiveCompany;
import com.cims.dto.report.ReportCommon.CompanyRating;
import com.cims.dto.report.ReportCommon.PeriodCount;
import com.cims.dto.report.ReportCommon.PopularInternship;
import com.cims.dto.report.ReportCommon.StatusCount;
import com.cims.dto.report.ReportCommon.StudentFeedbackAverages;
import com.cims.dto.report.ReportCommon.TopStudent;

public record AdminReportDto(PlacementSummary placement, ApplicationAnalytics applications,
                             StudentPerformance studentPerformance, CompanyStatistics companies,
                             SystemActivity systemActivity, Compliance compliance) {

    /** placementRate = placed students / active students × 100. */
    public record PlacementSummary(long totalStudents, long activeStudents, long studentsPlaced, Double placementRate,
                                   BigDecimal averageStipend) {
    }

    /** acceptanceRate = accepted / (total − withdrawn) × 100. */
    public record ApplicationAnalytics(long total, long accepted, Double acceptanceRate, List<StatusCount> statusBreakdown,
                                       List<PeriodCount> applicationsPerMonth) {
    }

    /** completionRate = completed internships / accepted applications × 100. */
    public record StudentPerformance(List<TopStudent> topStudents, List<PopularInternship> popularInternships,
                                     long acceptedInternships, long completedInternships, Double completionRate) {
    }

    public record CompanyStatistics(long totalCompanies, long activeCompanies, List<ActiveCompany> mostActive,
                                    List<CompanyRating> averageRatings, StudentFeedbackAverages studentFeedbackSummary) {
    }

    public record SystemActivity(List<PeriodCount> registrationsPerMonth, List<PeriodCount> loginsPerDay,
                                 long loginsLast30Days, long failedLoginsLast30Days, DataUsage dataUsage) {
    }

    public record DataUsage(long users, long students, long faculty, long companies, long internships,
                            long applications, long interviews, long evaluations, long feedbackEntries,
                            long resumesUploaded, long storedFileBytes) {
    }

    public record Compliance(List<ViolationCount> policyViolations, DocumentVerification documentVerification,
                             List<AuditEntry> recentViolations) {
    }

    public record ViolationCount(String type, String description, long last30Days, long allTime) {
    }

    public record DocumentVerification(long studentsWithResume, long studentsWithoutResume, long verifiedAccounts,
                                       long unverifiedAccounts, long applicationsWithResume, long totalApplications) {
    }

    public record AuditEntry(Long id, String action, String userEmail, String details, java.time.Instant createdAt) {
    }
}
