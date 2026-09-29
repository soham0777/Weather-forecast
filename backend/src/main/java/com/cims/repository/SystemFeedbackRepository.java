package com.cims.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.SystemFeedback;
import com.cims.entity.enums.SystemFeedbackStatus;
import com.cims.entity.enums.SystemFeedbackType;

public interface SystemFeedbackRepository extends JpaRepository<SystemFeedback, Long> {

    long countByStatus(SystemFeedbackStatus status);

    @EntityGraph(attributePaths = {"submittedBy", "handledBy"})
    Optional<SystemFeedback> findDetailedById(Long id);

    @EntityGraph(attributePaths = {"submittedBy", "handledBy"})
    @Query("""
            select f from SystemFeedback f
            where (:userId is null or f.submittedBy.id = :userId)
              and (:type is null or f.feedbackType = :type)
              and (:status is null or f.status = :status)
              and (:q is null or lower(f.title) like :q or lower(f.description) like :q)
            """)
    Page<SystemFeedback> search(@Param("userId") Long userId, @Param("type") SystemFeedbackType type,
                                @Param("status") SystemFeedbackStatus status, @Param("q") String q, Pageable pageable);
}
