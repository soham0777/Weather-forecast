package com.cims.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.cims.entity.enums.ApplicationStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

/** A student's application to an internship. UNIQUE(student_id, internship_id). */
@Getter
@Setter
@Entity
@Table(name = "applications",
        uniqueConstraints = @UniqueConstraint(name = "uk_applications_student_internship",
                columnNames = {"student_id", "internship_id"}))
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "internship_id", nullable = false)
    private Internship internship;

    /** Snapshot of the resume submitted with this application. */
    @Column(name = "resume_path", nullable = false, length = 255)
    private String resumePath;

    @Column(name = "cover_letter", nullable = false, columnDefinition = "TEXT")
    private String coverLetter;

    @Column(columnDefinition = "TEXT")
    private String qualifications;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private ApplicationStatus status = ApplicationStatus.PENDING;

    /** First time a faculty member / admin opened the application ("Under review"). */
    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    /** Set when the faculty coordinator marks the accepted internship as completed. */
    @Column(name = "completed_at")
    private Instant completedAt;

    @CreationTimestamp
    @Column(name = "applied_at", nullable = false, updatable = false)
    private Instant appliedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
