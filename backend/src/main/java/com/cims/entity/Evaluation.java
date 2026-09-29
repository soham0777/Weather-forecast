package com.cims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

/** Faculty/admin evaluation of an accepted intern. All ratings are integers 1–5. */
@Getter
@Setter
@Entity
@Table(name = "evaluations",
        uniqueConstraints = @UniqueConstraint(name = "uk_evaluations_application_evaluator",
                columnNames = {"application_id", "evaluator_id"}))
public class Evaluation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "evaluator_id", nullable = false)
    private User evaluator;

    @Column(name = "technical_skills", nullable = false, columnDefinition = "TINYINT")
    private Integer technicalSkills;

    @Column(name = "soft_skills", nullable = false, columnDefinition = "TINYINT")
    private Integer softSkills;

    @Column(nullable = false, columnDefinition = "TINYINT")
    private Integer punctuality;

    @Column(nullable = false, columnDefinition = "TINYINT")
    private Integer responsibility;

    @Column(nullable = false, columnDefinition = "TINYINT")
    private Integer teamwork;

    @Column(name = "learning_ability", nullable = false, columnDefinition = "TINYINT")
    private Integer learningAbility;

    @Column(name = "overall_rating", nullable = false, columnDefinition = "TINYINT")
    private Integer overallRating;

    @Column(length = 2000)
    private String comments;

    @Column(name = "is_archived", nullable = false)
    private boolean archived = false;
}
