package com.cims.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.Application;
import com.cims.entity.enums.ApplicationStatus;

public interface ApplicationRepository extends JpaRepository<Application, Long>, JpaSpecificationExecutor<Application> {

    @EntityGraph(attributePaths = {"student", "student.user", "internship", "internship.company",
            "internship.faculty", "internship.faculty.user"})
    Optional<Application> findDetailedById(Long id);

    boolean existsByStudentIdAndInternshipId(Long studentId, Long internshipId);

    Optional<Application> findByStudentIdAndInternshipId(Long studentId, Long internshipId);

    boolean existsByInternshipId(Long internshipId);

    long countByInternshipId(Long internshipId);

    long countByStatus(ApplicationStatus status);

    long countByStudentId(Long studentId);

    long countByStudentIdAndStatus(Long studentId, ApplicationStatus status);

    long countByInternshipFacultyId(Long facultyId);

    long countByInternshipFacultyIdAndStatus(Long facultyId, ApplicationStatus status);

    long countByCompletedAtIsNotNull();

    @Query("select a from Application a where a.student.id = :studentId and a.internship.id in :internshipIds")
    List<Application> findByStudentAndInternshipIds(@Param("studentId") Long studentId,
                                                    @Param("internshipIds") Collection<Long> internshipIds);

    /** True if the student has applied to any internship coordinated by the given faculty member. */
    @Query("select count(a) > 0 from Application a where a.student.id = :studentId and a.internship.faculty.id = :facultyId")
    boolean existsForStudentAndFaculty(@Param("studentId") Long studentId, @Param("facultyId") Long facultyId);

    @EntityGraph(attributePaths = {"internship", "internship.company"})
    List<Application> findByStudentIdAndStatusOrderByUpdatedAtDesc(Long studentId, ApplicationStatus status);
}
