package com.cims.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "E-mail is required.") @Size(max = 255) String email,
        @NotBlank(message = "Password is required.") @Size(max = 128) String password) {

    /** Surrounding whitespace (e.g. from copy-paste) is removed before validation. */
    public LoginRequest {
        email = email == null ? null : email.trim();
    }
}
