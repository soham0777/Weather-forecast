package com.cims.dto.auth;

import java.time.Instant;

public record AuthResponse(String token, String tokenType, Instant expiresAt, CurrentUserDto user) {

    public static AuthResponse bearer(String token, Instant expiresAt, CurrentUserDto user) {
        return new AuthResponse(token, "Bearer", expiresAt, user);
    }
}
