package com.cims.security;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.cims.entity.enums.AuditAction;
import com.cims.service.AuditService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Returns a JSON 403 response and records the attempt for the compliance report. */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final SecurityErrorWriter errorWriter;
    private final AuditService auditService;

    public RestAccessDeniedHandler(SecurityErrorWriter errorWriter, AuditService auditService) {
        this.errorWriter = errorWriter;
        this.auditService = auditService;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        auditService.logViolation(AuditAction.ACCESS_DENIED, null, null,
                request.getMethod() + " " + request.getRequestURI());
        errorWriter.write(request, response, HttpStatus.FORBIDDEN, "You do not have permission to perform this action.");
    }
}
