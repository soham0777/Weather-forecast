package com.cims.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyEmailRequest(@NotBlank(message = "Verification token is required.") @Size(max = 200) String token) {
}
