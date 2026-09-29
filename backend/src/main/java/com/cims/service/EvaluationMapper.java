package com.cims.service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.cims.dto.evaluation.EvaluationDto;
import com.cims.entity.Application;
import com.cims.entity.Evaluation;
import com.cims.entity.Faculty;
import com.cims.entity.User;
import com.cims.entity.enums.Role;
import com.cims.repository.FacultyRepository;

/** Converts evaluations to DTOs, resolving evaluator names in one query. */
@Component
public class EvaluationMapper {

    private final FacultyRepository facultyRepository;

    public EvaluationMapper(FacultyRepository facultyRepository) {
        this.facultyRepository = facultyRepository;
    }

    public List<EvaluationDto> toDtos(Collection<Evaluation> evaluations) {
        List<Long> evaluatorIds = evaluations.stream().map(e -> e.getEvaluator().getId()).distinct().toList();
        Map<Long, String> names = evaluatorIds.isEmpty() ? Map.of()
                : facultyRepository.findByUserIdIn(evaluatorIds).stream()
                        .collect(Collectors.toMap(f -> f.getUser().getId(), Faculty::getName, (a, b) -> a));
        return evaluations.stream().map(e -> toDto(e, names)).toList();
    }

    public EvaluationDto toDto(Evaluation evaluation) {
        return toDtos(List.of(evaluation)).get(0);
    }

    private static EvaluationDto toDto(Evaluation e, Map<Long, String> names) {
        Application a = e.getApplication();
        User evaluator = e.getEvaluator();
        String evaluatorName = evaluator.getRole() == Role.ADMIN ? "Administrator"
                : names.getOrDefault(evaluator.getId(), evaluator.getEmail());
        double average = (e.getTechnicalSkills() + e.getSoftSkills() + e.getPunctuality() + e.getResponsibility()
                + e.getTeamwork() + e.getLearningAbility()) / 6.0;
        return new EvaluationDto(e.getId(), a.getId(), a.getStudent().getId(), a.getStudent().getStudentName(),
                a.getInternship().getId(), a.getInternship().getTitle(), a.getInternship().getCompany().getName(),
                evaluator.getId(), evaluatorName, evaluator.getRole(), e.getTechnicalSkills(), e.getSoftSkills(),
                e.getPunctuality(), e.getResponsibility(), e.getTeamwork(), e.getLearningAbility(),
                e.getOverallRating(), Math.round(average * 100.0) / 100.0, e.getComments(), e.isArchived(),
                e.getCreatedAt(), e.getUpdatedAt());
    }
}
