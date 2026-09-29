package com.cims.dto.auth;

import com.cims.validation.StrongPassword;

import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
        @NotBlank(message = "Current password is required.") String currentPassword,
        @StrongPassword String newPassword) {
}
