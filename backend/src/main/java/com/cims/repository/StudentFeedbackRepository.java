package com.cims.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.StudentFeedback;

public interface StudentFeedbackRepository extends JpaRepository<StudentFeedback, Long> {

    @EntityGraph(attributePaths = {"application", "application.student", "application.internship",
            "application.internship.company"})
    Optional<StudentFeedback> findByApplicationId(Long applicationId);

    @EntityGraph(attributePaths = {"application", "application.student", "application.student.user",
            "application.internship", "application.internship.company", "application.internship.faculty",
            "application.internship.faculty.user"})
    Optional<StudentFeedback> findDetailedById(Long id);

    boolean existsByApplicationId(Long applicationId);

    /** Average student ratings. */
    interface RatingSummary {
        long getFeedbackCount();

        Double getCompanyCulture();

        Double getMentorshipQuality();

        Double getTechnicalLearning();

        Double getWorkEnvironment();

        Double getOverallExperience();
    }

    @Query("""
            select count(f) as feedbackCount, avg(f.companyCulture) as companyCulture,
                   avg(f.mentorshipQuality) as mentorshipQuality, avg(f.technicalLearning) as technicalLearning,
                   avg(f.workEnvironment) as workEnvironment, avg(f.overallExperience) as overallExperience
            from StudentFeedback f where f.application.internship.company.id = :companyId
            """)
    RatingSummary summaryForCompany(@Param("companyId") Long companyId);

    @Query("""
            select count(f) as feedbackCount, avg(f.companyCulture) as companyCulture,
                   avg(f.mentorshipQuality) as mentorshipQuality, avg(f.technicalLearning) as technicalLearning,
                   avg(f.workEnvironment) as workEnvironment, avg(f.overallExperience) as overallExperience
            from StudentFeedback f
            """)
    RatingSummary summaryOverall();

    @EntityGraph(attributePaths = {"application", "application.internship", "application.student"})
    @Query("select f from StudentFeedback f where f.application.internship.company.id = :companyId order by f.createdAt desc")
    List<StudentFeedback> findRecentForCompany(@Param("companyId") Long companyId, Pageable pageable);

    @EntityGraph(attributePaths = {"application", "application.student", "application.internship",
            "application.internship.company"})
    @Query(value = """
            select f from StudentFeedback f
            where (:studentId is null or f.application.student.id = :studentId)
              and (:facultyId is null or f.application.internship.faculty.id = :facultyId)
              and (:companyId is null or f.application.internship.company.id = :companyId)
            """,
            countQuery = """
            select count(f) from StudentFeedback f
            where (:studentId is null or f.application.student.id = :studentId)
              and (:facultyId is null or f.application.internship.faculty.id = :facultyId)
              and (:companyId is null or f.application.internship.company.id = :companyId)
            """)
    Page<StudentFeedback> search(@Param("studentId") Long studentId, @Param("facultyId") Long facultyId,
                                 @Param("companyId") Long companyId, Pageable pageable);
}
