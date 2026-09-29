package com.cims.exception;

import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * A request that is well-formed but violates a business rule (dates, ratings, 24-hour notice...).
 * Returned as 422 Unprocessable Entity, optionally with field-level messages.
 */
public class BusinessValidationException extends ApiException {

    private final Map<String, String> fieldErrors;

    public BusinessValidationException(String message) {
        this(message, Map.of());
    }

    public BusinessValidationException(String message, Map<String, String> fieldErrors) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, message);
        this.fieldErrors = fieldErrors;
    }

    public static BusinessValidationException forField(String field, String message) {
        return new BusinessValidationException(message, Map.of(field, message));
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
