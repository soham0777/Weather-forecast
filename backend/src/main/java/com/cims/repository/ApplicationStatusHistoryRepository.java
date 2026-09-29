package com.cims.repository;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.cims.entity.ApplicationStatusHistory;

public interface ApplicationStatusHistoryRepository extends JpaRepository<ApplicationStatusHistory, Long> {

    @EntityGraph(attributePaths = "changedBy")
    List<ApplicationStatusHistory> findByApplicationIdOrderByChangedAtAscIdAsc(Long applicationId);
}
