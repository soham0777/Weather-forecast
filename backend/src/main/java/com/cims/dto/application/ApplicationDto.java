package com.cims.dto.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.cims.entity.Application;
import com.cims.entity.Internship;
import com.cims.entity.Student;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.InternshipStatus;

/** Application row with the essential student and internship details. */
public record ApplicationDto(Long id, ApplicationStatus status, Instant appliedAt, Instant updatedAt,
                             Instant reviewedAt, Instant completedAt, StudentSummary student,
                             InternshipSummary internship) {

    public record StudentSummary(Long id, String name, String email, String phone, String department, BigDecimal gpa) {

        public static StudentSummary from(Student s) {
            return new StudentSummary(s.getId(), s.getStudentName(), s.getUser().getEmail(), s.getPhone(),
                    s.getDepartment(), s.getGpa());
        }
    }

    public record InternshipSummary(Long id, String title, Long companyId, String companyName, String location,
                                    String domain, BigDecimal stipend, LocalDate startDate, LocalDate endDate,
                                    LocalDate applicationDeadline, InternshipStatus status, Long facultyId,
                                    String facultyName) {

        public static InternshipSummary from(Internship i) {
            return new InternshipSummary(i.getId(), i.getTitle(), i.getCompany().getId(), i.getCompany().getName(),
                    i.getCompany().getLocation(), i.getDomain(), i.getStipend(), i.getStartDate(), i.getEndDate(),
                    i.getApplicationDeadline(), i.getStatus(), i.getFaculty().getId(), i.getFaculty().getName());
        }
    }

    public static ApplicationDto from(Application a) {
        return new ApplicationDto(a.getId(), a.getStatus(), a.getAppliedAt(), a.getUpdatedAt(), a.getReviewedAt(),
                a.getCompletedAt(), StudentSummary.from(a.getStudent()), InternshipSummary.from(a.getInternship()));
    }
}
