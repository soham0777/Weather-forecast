package com.cims.dto.common;

import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Envelope for every error response:
 * {@code {"success": false, "message": "...", "timestamp": "...", "status": 409, "errors": {...}}}.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ErrorResponse(boolean success, String message, Instant timestamp, int status,
                            String path, Map<String, String> errors) {

    public static ErrorResponse of(int status, String message, String path) {
        return new ErrorResponse(false, message, Instant.now(), status, path, null);
    }

    public static ErrorResponse of(int status, String message, String path, Map<String, String> errors) {
        return new ErrorResponse(false, message, Instant.now(), status, path, errors);
    }
}
