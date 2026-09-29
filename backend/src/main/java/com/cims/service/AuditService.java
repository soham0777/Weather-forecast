package com.cims.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.cims.entity.AuditLog;
import com.cims.entity.enums.AuditAction;
import com.cims.repository.AuditLogRepository;
import com.cims.repository.UserRepository;
import com.cims.security.SecurityUtils;
import com.cims.security.UserPrincipal;

/**
 * Records who did what and when. {@link #log} joins the caller's transaction so the audit
 * row is committed (or rolled back) together with the change it describes.
 * {@link #logViolation} runs in its own transaction so rejected actions are still recorded
 * when the surrounding request fails.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private static final int MAX_DETAILS = 1000;

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public AuditService(AuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void log(AuditAction action, String entityType, Long entityId, String details) {
        Long userId = SecurityUtils.currentPrincipal().map(UserPrincipal::id).orElse(null);
        save(userId, action, entityType, entityId, details);
    }

    @Transactional
    public void logForUser(Long userId, AuditAction action, String entityType, Long entityId, String details) {
        save(userId, action, entityType, entityId, details);
    }

    /** Records a rejected / suspicious action; never throws. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logViolation(AuditAction action, String entityType, Long entityId, String details) {
        try {
            Long userId = SecurityUtils.currentPrincipal().map(UserPrincipal::id).orElse(null);
            save(userId, action, entityType, entityId, details);
        } catch (RuntimeException ex) {
            log.warn("Could not record audit event {}: {}", action, ex.getMessage());
        }
    }

    private void save(Long userId, AuditAction action, String entityType, Long entityId, String details) {
        AuditLog entry = new AuditLog();
        entry.setUser(userId != null ? userRepository.getReferenceById(userId) : null);
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        if (details != null && details.length() > MAX_DETAILS) {
            details = details.substring(0, MAX_DETAILS);
        }
        entry.setDetails(details);
        auditLogRepository.save(entry);
    }
}
