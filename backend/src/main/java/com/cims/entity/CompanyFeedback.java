package com.cims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * The company's assessment of an intern. Companies have no login, so the feedback is
 * recorded in the system by the internship's faculty coordinator or an administrator.
 */
@Getter
@Setter
@Entity
@Table(name = "company_feedback")
public class CompanyFeedback extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false, unique = true)
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recorded_by", nullable = false)
    private User recordedBy;

    @Column(name = "company_representative", length = 100)
    private String companyRepresentative;

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

    /** 1 = very unlikely … 5 = very likely to offer a full-time role. */
    @Column(name = "hire_likelihood", nullable = false, columnDefinition = "TINYINT")
    private Integer hireLikelihood;

    @Column(length = 1000)
    private String strengths;

    @Column(name = "areas_for_improvement", length = 1000)
    private String areasForImprovement;

    @Column(length = 2000)
    private String comments;
}
