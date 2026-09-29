package com.cims.dto.feedback;

import java.time.Instant;

import com.cims.entity.FacultyFeedback;

public record FacultyFeedbackDto(Long id, Long internshipId, String internshipTitle, String companyName,
                                 Long facultyId, String facultyName, int courseSuitability, int learningOutcomes,
                                 int internshipQuality, String learningOutcomesNotes, String suggestions,
                                 Instant createdAt, Instant updatedAt) {

    public static FacultyFeedbackDto from(FacultyFeedback f) {
        return new FacultyFeedbackDto(f.getId(), f.getInternship().getId(), f.getInternship().getTitle(),
                f.getInternship().getCompany().getName(), f.getFaculty().getId(), f.getFaculty().getName(),
                f.getCourseSuitability(), f.getLearningOutcomes(), f.getInternshipQuality(),
                f.getLearningOutcomesNotes(), f.getSuggestions(), f.getCreatedAt(), f.getUpdatedAt());
    }
}
