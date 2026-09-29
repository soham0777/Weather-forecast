package com.cims.dto.application;

import com.cims.entity.enums.ApplicationStatus;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Reviewer decision: SHORTLISTED, REJECTED or ACCEPTED. */
public record ApplicationStatusRequest(
        @NotNull(message = "Status is required.") ApplicationStatus status,
        @Size(max = 500, message = "Comment must be at most 500 characters.") String comment) {
}
