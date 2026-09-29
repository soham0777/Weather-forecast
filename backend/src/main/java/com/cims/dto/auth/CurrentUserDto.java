package com.cims.dto.auth;

import java.time.Instant;

import com.cims.entity.enums.Role;

/**
 * The signed-in user as seen by the frontend. {@code profileId} is the id of the student or
 * faculty profile (null for administrators).
 */
public record CurrentUserDto(Long id, String email, Role role, String name, Long profileId,
                             boolean active, boolean verified, Instant lastLoginAt) {
}
