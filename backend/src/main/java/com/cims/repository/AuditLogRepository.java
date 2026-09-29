package com.cims.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.AuditLog;
import com.cims.entity.enums.AuditAction;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @Query("select a.createdAt from AuditLog a where a.action = :action and a.createdAt >= :since")
    List<Instant> findTimestamps(@Param("action") AuditAction action, @Param("since") Instant since);

    long countByActionAndCreatedAtGreaterThanEqual(AuditAction action, Instant since);

    long countByAction(AuditAction action);

    @EntityGraph(attributePaths = "user")
    @Query("select a from AuditLog a where (:action is null or a.action = :action)")
    Page<AuditLog> search(@Param("action") AuditAction action, Pageable pageable);
}
