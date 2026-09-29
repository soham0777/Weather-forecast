package com.cims.exception;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.cims.dto.common.ErrorResponse;
import com.cims.entity.enums.AuditAction;
import com.cims.service.AuditService;
import com.fasterxml.jackson.databind.JsonMappingException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

/**
 * Converts every exception into the standard {@link ErrorResponse}. Stack traces and
 * internal details are logged on the server but never returned to the client.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Friendly messages for unique / check constraints that can be hit by concurrent requests. */
    private static final Map<String, String> CONSTRAINT_MESSAGES = Map.of(
            "uk_users_email", "An account with this e-mail address already exists.",
            "uk_applications_student_internship", "You have already applied for this internship.",
            "uk_companies_registration_number", "A company with this registration number already exists.",
            "uk_evaluations_application_evaluator", "You have already evaluated this student for this internship.",
            "uk_student_feedback_application", "Feedback has already been submitted for this internship.",
            "uk_company_feedback_application", "Company feedback has already been recorded for this student.",
            "uk_faculty_feedback_internship_faculty", "You have already submitted feedback for this internship.");

    private final AuditService auditService;

    public GlobalExceptionHandler(AuditService auditService) {
        this.auditService = auditService;
    }

    @ExceptionHandler(BusinessValidationException.class)
    public ResponseEntity<ErrorResponse> handleBusinessValidation(BusinessValidationException ex, HttpServletRequest request) {
        return build(ex.getStatus(), ex.getMessage(), request, ex.getFieldErrors());
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        return build(ex.getStatus(), ex.getMessage(), request, null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        ex.getBindingResult().getGlobalErrors()
                .forEach(error -> errors.putIfAbsent(error.getObjectName(), error.getDefaultMessage()));
        return build(HttpStatus.UNPROCESSABLE_ENTITY, summarise(errors), request, errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleMethodValidation(HandlerMethodValidationException ex, HttpServletRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getParameterValidationResults().forEach(result -> {
            String name = result.getMethodParameter().getParameterName();
            result.getResolvableErrors().forEach(error -> errors.putIfAbsent(name != null ? name : "parameter",
                    error.getDefaultMessage()));
        });
        return build(HttpStatus.UNPROCESSABLE_ENTITY, summarise(errors), request, errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        Map<String, String> errors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(v -> lastNode(v.getPropertyPath().toString()), v -> v.getMessage(),
                        (a, b) -> a, LinkedHashMap::new));
        return build(HttpStatus.UNPROCESSABLE_ENTITY, summarise(errors), request, errors);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        if (ex.getCause() instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()) {
            String field = mapping.getPath().stream()
                    .map(ref -> ref.getFieldName() != null ? ref.getFieldName() : "[" + ref.getIndex() + "]")
                    .collect(Collectors.joining("."));
            String message = "Invalid value for '" + field + "'. Please check the value type (e.g. whole numbers for ratings, yyyy-MM-dd for dates).";
            return build(HttpStatus.BAD_REQUEST, message, request, Map.of(field, "Invalid value."));
        }
        return build(HttpStatus.BAD_REQUEST, "The request body is missing or is not valid JSON.", request, null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String message = "Invalid value '" + ex.getValue() + "' for parameter '" + ex.getName() + "'.";
        return build(HttpStatus.BAD_REQUEST, message, request, null);
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    public ResponseEntity<ErrorResponse> handleMissingParameter(Exception ex, HttpServletRequest request) {
        String name = ex instanceof MissingServletRequestParameterException p ? p.getParameterName()
                : ((MissingServletRequestPartException) ex).getRequestPartName();
        return build(HttpStatus.BAD_REQUEST, "Required parameter '" + name + "' is missing.", request, null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUpload(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        auditService.logViolation(AuditAction.INVALID_FILE_UPLOAD, null, null, "File larger than 5 MB rejected");
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "The file is too large. The maximum allowed size is 5 MB.", request, null);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipart(MultipartException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "The file upload request is invalid.", request, null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
        String detail = String.valueOf(ex.getMostSpecificCause().getMessage()).toLowerCase(Locale.ROOT);
        String message = CONSTRAINT_MESSAGES.entrySet().stream()
                .filter(entry -> detail.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse("The request conflicts with existing data. Please refresh and try again.");
        log.warn("Data integrity violation on {}: {}", request.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT, message, request, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        auditService.logViolation(AuditAction.ACCESS_DENIED, null, null, request.getMethod() + " " + request.getRequestURI());
        return build(HttpStatus.FORBIDDEN, "You do not have permission to perform this action.", request, null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex, HttpServletRequest request) {
        return build(HttpStatus.UNAUTHORIZED, "Authentication is required. Please log in.", request, null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND, "The requested endpoint does not exist.", request, null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return build(HttpStatus.METHOD_NOT_ALLOWED, "HTTP method " + ex.getMethod() + " is not supported for this endpoint.", request, null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaType(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        return build(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported content type.", request, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unexpected error on {} {}", request.getMethod(), request.getRequestURI(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred. Please try again later.", request, null);
    }

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String message, HttpServletRequest request,
                                                Map<String, String> errors) {
        return ResponseEntity.status(status)
                .body(ErrorResponse.of(status.value(), message, request.getRequestURI(), errors));
    }

    private static String summarise(Map<String, String> errors) {
        if (errors.size() == 1) {
            return errors.values().iterator().next();
        }
        return "Please correct the highlighted fields.";
    }

    private static String lastNode(String path) {
        int dot = path.lastIndexOf('.');
        return dot >= 0 ? path.substring(dot + 1) : path;
    }
}
