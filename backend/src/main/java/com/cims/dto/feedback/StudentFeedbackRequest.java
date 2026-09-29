package com.cims.dto.feedback;

import com.cims.validation.Rating;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StudentFeedbackRequest(
        @NotNull(message = "Application is required.") Long applicationId,
        @Rating Integer companyCulture,
        @Rating Integer mentorshipQuality,
        @Rating Integer technicalLearning,
        @Rating Integer workEnvironment,
        @Rating Integer overallExperience,
        @Size(max = 2000, message = "Comments must be at most 2000 characters.") String comments,
        @Size(max = 2000, message = "Suggestions must be at most 2000 characters.") String suggestions) {
}
