package com.cims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.cims.entity.FacultyFeedback;

public interface FacultyFeedbackRepository extends JpaRepository<FacultyFeedback, Long>, JpaSpecificationExecutor<FacultyFeedback> {

    boolean existsByInternshipIdAndFacultyId(Long internshipId, Long facultyId);
}
