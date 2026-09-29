package com.cims.dto.evaluation;

import java.time.Instant;

import com.cims.entity.enums.Role;

public record EvaluationDto(Long id, Long applicationId, Long studentId, String studentName, Long internshipId,
                            String internshipTitle, String companyName, Long evaluatorId, String evaluatorName,
                            Role evaluatorRole, int technicalSkills, int softSkills, int punctuality,
                            int responsibility, int teamwork, int learningAbility, int overallRating,
                            double averageCriteriaScore, String comments, boolean archived, Instant createdAt,
                            Instant updatedAt) {
}
