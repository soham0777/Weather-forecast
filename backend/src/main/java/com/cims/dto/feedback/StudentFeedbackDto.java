package com.cims.dto.feedback;

import java.time.Instant;

import com.cims.entity.Application;
import com.cims.entity.StudentFeedback;

public record StudentFeedbackDto(Long id, Long applicationId, Long studentId, String studentName, Long internshipId,
                                 String internshipTitle, Long companyId, String companyName, int companyCulture,
                                 int mentorshipQuality, int technicalLearning, int workEnvironment,
                                 int overallExperience, String comments, String suggestions, Instant createdAt,
                                 Instant updatedAt) {

    public static StudentFeedbackDto from(StudentFeedback f) {
        Application a = f.getApplication();
        return new StudentFeedbackDto(f.getId(), a.getId(), a.getStudent().getId(), a.getStudent().getStudentName(),
                a.getInternship().getId(), a.getInternship().getTitle(), a.getInternship().getCompany().getId(),
                a.getInternship().getCompany().getName(), f.getCompanyCulture(), f.getMentorshipQuality(),
                f.getTechnicalLearning(), f.getWorkEnvironment(), f.getOverallExperience(), f.getComments(),
                f.getSuggestions(), f.getCreatedAt(), f.getUpdatedAt());
    }
}
