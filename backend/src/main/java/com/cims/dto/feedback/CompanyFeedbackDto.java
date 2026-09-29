package com.cims.dto.feedback;

import java.time.Instant;

import com.cims.entity.Application;
import com.cims.entity.CompanyFeedback;

public record CompanyFeedbackDto(Long id, Long applicationId, Long studentId, String studentName, Long internshipId,
                                 String internshipTitle, Long companyId, String companyName,
                                 String companyRepresentative, int technicalSkills, int softSkills, int punctuality,
                                 int responsibility, int teamwork, int learningAbility, int hireLikelihood,
                                 String strengths, String areasForImprovement, String comments,
                                 String recordedByEmail, Instant createdAt, Instant updatedAt) {

    public static CompanyFeedbackDto from(CompanyFeedback f) {
        Application a = f.getApplication();
        return new CompanyFeedbackDto(f.getId(), a.getId(), a.getStudent().getId(), a.getStudent().getStudentName(),
                a.getInternship().getId(), a.getInternship().getTitle(), a.getInternship().getCompany().getId(),
                a.getInternship().getCompany().getName(), f.getCompanyRepresentative(), f.getTechnicalSkills(),
                f.getSoftSkills(), f.getPunctuality(), f.getResponsibility(), f.getTeamwork(), f.getLearningAbility(),
                f.getHireLikelihood(), f.getStrengths(), f.getAreasForImprovement(), f.getComments(),
                f.getRecordedBy().getEmail(), f.getCreatedAt(), f.getUpdatedAt());
    }
}
