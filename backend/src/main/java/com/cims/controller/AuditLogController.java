package com.cims.controller;

import java.time.Instant;

import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.common.ApiResponse;
import com.cims.dto.common.PageResponse;
import com.cims.entity.enums.AuditAction;
import com.cims.repository.AuditLogRepository;
import com.cims.util.PageUtils;

import java.util.Map;

/** Read-only audit trail for administrators. */
@RestController
@RequestMapping("/api/audit-logs")
@PreAuthorize("hasRole('ADMIN')")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    public AuditLogController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<AuditLogDto>> list(@RequestParam(required = false) AuditAction action,
                                                       @RequestParam(required = false) Integer page,
                                                       @RequestParam(required = false) Integer size) {
        var pageable = PageUtils.of(page, size, null, Map.of(), Sort.by(Sort.Direction.DESC, "createdAt"));
        return ApiResponse.ok(PageResponse.of(auditLogRepository.search(action, pageable),
                a -> new AuditLogDto(a.getId(), a.getAction(), a.getUser() != null ? a.getUser().getEmail() : null,
                        a.getEntityType(), a.getEntityId(), a.getDetails(), a.getCreatedAt())));
    }

    public record AuditLogDto(Long id, AuditAction action, String userEmail, String entityType, Long entityId,
                              String details, Instant createdAt) {
    }
}
