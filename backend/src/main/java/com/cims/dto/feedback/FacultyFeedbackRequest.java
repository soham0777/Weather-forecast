package com.cims.dto.feedback;

import com.cims.validation.Rating;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Faculty quality-assurance feedback about an internship they coordinate. */
public record FacultyFeedbackRequest(
        @NotNull(message = "Internship is required.") Long internshipId,
        @Rating Integer courseSuitability,
        @Rating Integer learningOutcomes,
        @Rating Integer internshipQuality,
        @Size(max = 2000, message = "Learning outcome notes must be at most 2000 characters.") String learningOutcomesNotes,
        @Size(max = 2000, message = "Suggestions must be at most 2000 characters.") String suggestions) {
}
