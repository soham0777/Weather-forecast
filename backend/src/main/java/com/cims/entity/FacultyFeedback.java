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

/** Faculty quality-assurance feedback about an internship. */
@Getter
@Setter
@Entity
@Table(name = "faculty_feedback",
        uniqueConstraints = @UniqueConstraint(name = "uk_faculty_feedback_internship_faculty",
                columnNames = {"internship_id", "faculty_id"}))
public class FacultyFeedback extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "internship_id", nullable = false)
    private Internship internship;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "faculty_id", nullable = false)
    private Faculty faculty;

    @Column(name = "course_suitability", nullable = false, columnDefinition = "TINYINT")
    private Integer courseSuitability;

    @Column(name = "learning_outcomes", nullable = false, columnDefinition = "TINYINT")
    private Integer learningOutcomes;

    @Column(name = "internship_quality", nullable = false, columnDefinition = "TINYINT")
    private Integer internshipQuality;

    @Column(name = "learning_outcomes_notes", length = 2000)
    private String learningOutcomesNotes;

    @Column(length = 2000)
    private String suggestions;
}
