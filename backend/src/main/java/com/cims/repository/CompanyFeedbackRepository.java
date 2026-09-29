package com.cims.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.cims.entity.CompanyFeedback;

public interface CompanyFeedbackRepository extends JpaRepository<CompanyFeedback, Long>, JpaSpecificationExecutor<CompanyFeedback> {

    Optional<CompanyFeedback> findByApplicationId(Long applicationId);

    boolean existsByApplicationId(Long applicationId);
}
