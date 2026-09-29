package com.cims.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.cims.entity.StudentFeedback;

public interface StudentFeedbackRepository extends JpaRepository<StudentFeedback, Long>, JpaSpecificationExecutor<StudentFeedback> {

    Optional<StudentFeedback> findByApplicationId(Long applicationId);

    boolean existsByApplicationId(Long applicationId);
}
