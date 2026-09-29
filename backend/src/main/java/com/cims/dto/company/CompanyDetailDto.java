package com.cims.dto.company;

import java.time.Instant;
import java.util.List;

import com.cims.dto.internship.InternshipDto;

/** Company profile with its internships, rating summary and recent student feedback. */
public record CompanyDetailDto(CompanyDto company, List<InternshipDto> internships, RatingSummary ratings,
                               List<FeedbackEntry> recentFeedback) {

    /** Averages of student feedback (1–5). All values are null when no feedback exists. */
    public record RatingSummary(long feedbackCount, Double companyCulture, Double mentorshipQuality,
                                Double technicalLearning, Double workEnvironment, Double overallExperience) {
    }

    /** {@code studentName} is only filled for staff; students see anonymous feedback. */
    public record FeedbackEntry(Long id, String internshipTitle, String studentName, int overallExperience,
                                String comments, String suggestions, Instant createdAt) {
    }
}
