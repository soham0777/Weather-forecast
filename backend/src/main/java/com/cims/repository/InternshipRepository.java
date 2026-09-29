package com.cims.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.Internship;
import com.cims.entity.enums.InternshipStatus;

public interface InternshipRepository extends JpaRepository<Internship, Long>, JpaSpecificationExecutor<Internship> {

    @EntityGraph(attributePaths = {"company", "faculty", "faculty.user"})
    Optional<Internship> findDetailedById(Long id);

    long countByStatus(InternshipStatus status);

    long countByStatusIn(Collection<InternshipStatus> statuses);

    long countByFacultyId(Long facultyId);

    long countByFacultyIdAndStatus(Long facultyId, InternshipStatus status);

    long countByCompanyId(Long companyId);

    long countByCompanyIdAndStatusIn(Long companyId, Collection<InternshipStatus> statuses);

    @EntityGraph(attributePaths = "company")
    List<Internship> findByCompanyIdOrderByCreatedAtDesc(Long companyId);

    @EntityGraph(attributePaths = "company")
    List<Internship> findByFacultyIdOrderByCreatedAtDesc(Long facultyId);

    @Query("select distinct i.domain from Internship i where i.status in :statuses order by i.domain")
    List<String> findDistinctDomains(@Param("statuses") Collection<InternshipStatus> statuses);

    @Query("select distinct c.location from Internship i join i.company c where i.status in :statuses order by c.location")
    List<String> findDistinctLocations(@Param("statuses") Collection<InternshipStatus> statuses);

    /** Closes open internships whose application deadline has passed. */
    @Modifying
    @Query("update Internship i set i.status = com.cims.entity.enums.InternshipStatus.CLOSED, i.updatedAt = :now "
            + "where i.status = com.cims.entity.enums.InternshipStatus.OPEN and i.applicationDeadline < :today")
    int closeExpired(@Param("today") LocalDate today, @Param("now") Instant now);
}
