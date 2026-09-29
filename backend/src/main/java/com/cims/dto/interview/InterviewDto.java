package com.cims.dto.interview;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

import com.cims.entity.Application;
import com.cims.entity.Interview;
import com.cims.entity.enums.InterviewResult;
import com.cims.entity.enums.InterviewStatus;

public record InterviewDto(Long id, Long applicationId, LocalDate interviewDate, LocalTime interviewTime,
                           String interviewerName, String interviewerDetails, InterviewStatus status,
                           InterviewResult result, String comments, Instant completedAt, Instant cancelledAt,
                           Instant createdAt, Instant updatedAt, Long studentId, String studentName,
                           String studentEmail, Long internshipId, String internshipTitle, String companyName) {

    public static InterviewDto from(Interview i) {
        Application a = i.getApplication();
        return new InterviewDto(i.getId(), a.getId(), i.getInterviewDate(), i.getInterviewTime(),
                i.getInterviewerName(), i.getInterviewerDetails(), i.getStatus(), i.getResult(), i.getComments(),
                i.getCompletedAt(), i.getCancelledAt(), i.getCreatedAt(), i.getUpdatedAt(),
                a.getStudent().getId(), a.getStudent().getStudentName(), a.getStudent().getUser().getEmail(),
                a.getInternship().getId(), a.getInternship().getTitle(), a.getInternship().getCompany().getName());
    }
}
