package com.cims.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.cims.entity.Evaluation;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long>, JpaSpecificationExecutor<Evaluation> {

    @EntityGraph(attributePaths = {"application", "application.student", "application.internship",
            "application.internship.company", "evaluator"})
    Optional<Evaluation> findDetailedById(Long id);

    Optional<Evaluation> findByApplicationIdAndEvaluatorId(Long applicationId, Long evaluatorId);

    @EntityGraph(attributePaths = "evaluator")
    List<Evaluation> findByApplicationIdAndArchivedFalse(Long applicationId);

    long countByArchivedFalse();
}
