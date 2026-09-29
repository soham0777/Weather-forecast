package com.cims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.cims.entity.SystemFeedback;
import com.cims.entity.enums.SystemFeedbackStatus;

public interface SystemFeedbackRepository extends JpaRepository<SystemFeedback, Long>, JpaSpecificationExecutor<SystemFeedback> {

    long countByStatus(SystemFeedbackStatus status);
}
