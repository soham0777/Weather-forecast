package com.cims.dto.feedback;

import com.cims.entity.enums.SystemFeedbackType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SystemFeedbackRequest(
        @NotNull(message = "Feedback type is required.") SystemFeedbackType feedbackType,
        @NotBlank(message = "Title is required.") @Size(min = 5, max = 150, message = "Title must be between 5 and 150 characters.") String title,
        @NotBlank(message = "Description is required.") @Size(min = 10, max = 5000, message = "Description must be between 10 and 5000 characters.") String description) {
}
