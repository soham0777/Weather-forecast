package com.cims.dto.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A student's application. The resume on the student's profile is attached automatically. */
public record ApplicationRequest(
        @NotNull(message = "Internship is required.") Long internshipId,
        @NotBlank(message = "Cover letter is required.")
        @Size(min = 50, max = 3000, message = "Cover letter must be between 50 and 3000 characters.") String coverLetter,
        @Size(max = 2000, message = "Qualifications must be at most 2000 characters.") String qualifications) {
}
