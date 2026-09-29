package com.cims.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.CompanyFeedback;

public interface CompanyFeedbackRepository extends JpaRepository<CompanyFeedback, Long> {

    @EntityGraph(attributePaths = {"application", "application.student", "application.internship",
            "application.internship.company", "recordedBy"})
    Optional<CompanyFeedback> findByApplicationId(Long applicationId);

    @EntityGraph(attributePaths = {"application", "application.student", "application.student.user",
            "application.internship", "application.internship.company", "application.internship.faculty",
            "application.internship.faculty.user", "recordedBy"})
    Optional<CompanyFeedback> findDetailedById(Long id);

    boolean existsByApplicationId(Long applicationId);

    @EntityGraph(attributePaths = {"application", "application.student", "application.internship",
            "application.internship.company", "recordedBy"})
    @Query(value = """
            select f from CompanyFeedback f
            where (:studentId is null or f.application.student.id = :studentId)
              and (:facultyId is null or f.application.internship.faculty.id = :facultyId)
              and (:companyId is null or f.application.internship.company.id = :companyId)
            """,
            countQuery = """
            select count(f) from CompanyFeedback f
            where (:studentId is null or f.application.student.id = :studentId)
              and (:facultyId is null or f.application.internship.faculty.id = :facultyId)
              and (:companyId is null or f.application.internship.company.id = :companyId)
            """)
    Page<CompanyFeedback> search(@Param("studentId") Long studentId, @Param("facultyId") Long facultyId,
                                 @Param("companyId") Long companyId, Pageable pageable);
}
