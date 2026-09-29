package com.cims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Student's post-internship feedback about the company/internship. */
@Getter
@Setter
@Entity
@Table(name = "student_feedback")
public class StudentFeedback extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false, unique = true)
    private Application application;

    @Column(name = "company_culture", nullable = false, columnDefinition = "TINYINT")
    private Integer companyCulture;

    @Column(name = "mentorship_quality", nullable = false, columnDefinition = "TINYINT")
    private Integer mentorshipQuality;

    @Column(name = "technical_learning", nullable = false, columnDefinition = "TINYINT")
    private Integer technicalLearning;

    @Column(name = "work_environment", nullable = false, columnDefinition = "TINYINT")
    private Integer workEnvironment;

    @Column(name = "overall_experience", nullable = false, columnDefinition = "TINYINT")
    private Integer overallExperience;

    @Column(length = 2000)
    private String comments;

    @Column(length = 2000)
    private String suggestions;
}
