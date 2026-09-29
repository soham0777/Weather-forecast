package com.cims.dto.evaluation;

import com.cims.validation.Rating;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Evaluation of an accepted intern. Every rating is a whole number from 1 to 5. */
public record EvaluationRequest(
        @NotNull(message = "Application is required.") Long applicationId,
        @Rating Integer technicalSkills,
        @Rating Integer softSkills,
        @Rating Integer punctuality,
        @Rating Integer responsibility,
        @Rating Integer teamwork,
        @Rating Integer learningAbility,
        @Rating Integer overallRating,
        @Size(max = 2000, message = "Comments must be at most 2000 characters.") String comments) {
}
