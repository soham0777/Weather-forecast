package com.cims.dto.feedback;

import com.cims.entity.enums.SystemFeedbackStatus;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Admin triage of system feedback. */
public record SystemFeedbackStatusRequest(
        @NotNull(message = "Status is required.") SystemFeedbackStatus status,
        @Size(max = 2000, message = "Response must be at most 2000 characters.") String adminResponse) {
}
