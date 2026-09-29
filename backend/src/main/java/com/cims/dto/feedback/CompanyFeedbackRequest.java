package com.cims.dto.feedback;

import com.cims.validation.Rating;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** The company's rating of an intern, entered by the faculty coordinator or an admin. */
public record CompanyFeedbackRequest(
        @NotNull(message = "Application is required.") Long applicationId,
        @Size(max = 100, message = "Representative name must be at most 100 characters.") String companyRepresentative,
        @Rating Integer technicalSkills,
        @Rating Integer softSkills,
        @Rating Integer punctuality,
        @Rating Integer responsibility,
        @Rating Integer teamwork,
        @Rating Integer learningAbility,
        @Rating Integer hireLikelihood,
        @Size(max = 1000, message = "Strengths must be at most 1000 characters.") String strengths,
        @Size(max = 1000, message = "Areas for improvement must be at most 1000 characters.") String areasForImprovement,
        @Size(max = 2000, message = "Comments must be at most 2000 characters.") String comments) {
}
