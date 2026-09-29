package com.cims.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.FacultyFeedback;

public interface FacultyFeedbackRepository extends JpaRepository<FacultyFeedback, Long> {

    boolean existsByInternshipIdAndFacultyId(Long internshipId, Long facultyId);

    boolean existsByInternshipId(Long internshipId);

    @EntityGraph(attributePaths = {"internship", "internship.company", "faculty", "faculty.user"})
    Optional<FacultyFeedback> findDetailedById(Long id);

    @EntityGraph(attributePaths = {"internship", "internship.company", "faculty"})
    @Query(value = """
            select f from FacultyFeedback f
            where (:facultyId is null or f.faculty.id = :facultyId)
              and (:internshipId is null or f.internship.id = :internshipId)
            """,
            countQuery = """
            select count(f) from FacultyFeedback f
            where (:facultyId is null or f.faculty.id = :facultyId)
              and (:internshipId is null or f.internship.id = :internshipId)
            """)
    Page<FacultyFeedback> search(@Param("facultyId") Long facultyId, @Param("internshipId") Long internshipId,
                                 Pageable pageable);
}
