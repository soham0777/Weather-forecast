package com.cims.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.Evaluation;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {

    @EntityGraph(attributePaths = {"application", "application.student", "application.student.user",
            "application.internship", "application.internship.company", "application.internship.faculty",
            "application.internship.faculty.user", "evaluator"})
    Optional<Evaluation> findDetailedById(Long id);

    Optional<Evaluation> findByApplicationIdAndEvaluatorId(Long applicationId, Long evaluatorId);

    @EntityGraph(attributePaths = {"evaluator", "application", "application.student", "application.internship",
            "application.internship.company"})
    List<Evaluation> findByApplicationIdAndArchivedFalse(Long applicationId);

    long countByArchivedFalse();

    @EntityGraph(attributePaths = {"evaluator", "application", "application.student", "application.internship",
            "application.internship.company"})
    @Query(value = """
            select e from Evaluation e
            where (:studentId is null or e.application.student.id = :studentId)
              and (:facultyId is null or e.application.internship.faculty.id = :facultyId)
              and (:internshipId is null or e.application.internship.id = :internshipId)
              and (:includeArchived = true or e.archived = false)
              and (:q is null or lower(e.application.student.studentName) like :q
                   or lower(e.application.internship.title) like :q)
            """,
            countQuery = """
            select count(e) from Evaluation e
            where (:studentId is null or e.application.student.id = :studentId)
              and (:facultyId is null or e.application.internship.faculty.id = :facultyId)
              and (:internshipId is null or e.application.internship.id = :internshipId)
              and (:includeArchived = true or e.archived = false)
              and (:q is null or lower(e.application.student.studentName) like :q
                   or lower(e.application.internship.title) like :q)
            """)
    Page<Evaluation> search(@Param("studentId") Long studentId, @Param("facultyId") Long facultyId,
                            @Param("internshipId") Long internshipId, @Param("includeArchived") boolean includeArchived,
                            @Param("q") String q, Pageable pageable);
}
