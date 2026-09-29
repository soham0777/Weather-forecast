package com.cims.dto.internship;

import com.cims.entity.enums.InternshipStatus;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Status change: APPROVED / REJECTED (admin), OPEN / CLOSED (owner or admin). */
public record InternshipStatusRequest(
        @NotNull(message = "Status is required.") InternshipStatus status,
        @Size(max = 500, message = "Remarks must be at most 500 characters.") String remarks) {
}
