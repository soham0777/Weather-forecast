package com.cims.dto.common;

import java.time.Instant;

/** Envelope for successful responses: {@code {success, message, data, timestamp}}. */
public record ApiResponse<T>(boolean success, String message, T data, Instant timestamp) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, null, data, Instant.now());
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data, Instant.now());
    }

    public static ApiResponse<Void> message(String message) {
        return new ApiResponse<>(true, message, null, Instant.now());
    }
}
