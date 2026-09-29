package com.cims.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.cims.entity.Interview;
import com.cims.entity.enums.InterviewStatus;

public interface InterviewRepository extends JpaRepository<Interview, Long>, JpaSpecificationExecutor<Interview> {

    @EntityGraph(attributePaths = {"application", "application.student", "application.student.user",
            "application.internship", "application.internship.company", "application.internship.faculty"})
    Optional<Interview> findDetailedById(Long id);

    List<Interview> findByApplicationIdOrderByInterviewDateAscInterviewTimeAsc(Long applicationId);

    List<Interview> findByApplicationIdAndStatus(Long applicationId, InterviewStatus status);

    boolean existsByApplicationIdAndStatus(Long applicationId, InterviewStatus status);

    long countByStatus(InterviewStatus status);
}
