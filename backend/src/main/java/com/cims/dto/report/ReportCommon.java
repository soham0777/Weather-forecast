package com.cims.dto.report;

import java.math.BigDecimal;

/** Small value types shared by the report DTOs. Null numbers mean "no data available". */
public final class ReportCommon {

    private ReportCommon() {
    }

    public record StatusCount(String status, long count) {
    }

    /** {@code period} is "yyyy-MM" for months or "yyyy-MM-dd" for days. */
    public record PeriodCount(String period, long count) {
    }

    public record TopStudent(Long studentId, String name, String department, Double averageRating, long evaluationCount) {
    }

    public record PopularInternship(Long internshipId, String title, String companyName, long applicationCount) {
    }

    public record ActiveCompany(Long companyId, String name, long internshipCount, long applicationCount,
                                long acceptedCount) {
    }

    public record CompanyRating(Long companyId, String name, Double averageOverall, long feedbackCount) {
    }

    public record InternshipApplications(Long internshipId, String title, String status, long total, long pending,
                                         long shortlisted, long accepted, long rejected, long withdrawn) {
    }

    /** Averages of the six performance criteria plus an overall value (1–5 scale). */
    public record PerformanceAverages(long count, Double technicalSkills, Double softSkills, Double punctuality,
                                      Double responsibility, Double teamwork, Double learningAbility, Double overall) {
    }

    public record StudentFeedbackAverages(long count, Double companyCulture, Double mentorshipQuality,
                                          Double technicalLearning, Double workEnvironment, Double overallExperience) {
    }

    public record Offer(Long applicationId, Long internshipId, String internshipTitle, String companyName,
                        String location, BigDecimal stipend, java.time.LocalDate startDate,
                        java.time.LocalDate endDate, Integer durationWeeks, java.time.Instant acceptedAt,
                        java.time.Instant completedAt) {
    }
}
