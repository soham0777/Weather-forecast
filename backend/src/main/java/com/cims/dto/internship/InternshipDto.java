package com.cims.dto.internship;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.InternshipStatus;

/**
 * Internship as returned by the API.
 *
 * @param acceptingApplications true when the internship is OPEN and the deadline has not passed
 * @param applicationCount      number of applications (staff only; null for students)
 * @param myApplicationId       the current student's application, if any (students only)
 */
public record InternshipDto(Long id, String title, String description, String domain, Long companyId,
                            String companyName, String location, Long facultyId, String facultyName,
                            Integer durationWeeks, BigDecimal stipend, LocalDate startDate, LocalDate endDate,
                            LocalDate applicationDeadline, InternshipStatus status, boolean acceptingApplications,
                            String reviewRemarks, Instant reviewedAt, Long applicationCount, Long myApplicationId,
                            ApplicationStatus myApplicationStatus, Instant createdAt, Instant updatedAt) {
}
