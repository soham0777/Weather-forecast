package com.cims.entity;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "students")
public class Student extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "student_name", nullable = false, length = 100)
    private String studentName;

    @Column(nullable = false, length = 16)
    private String phone;

    @Column(nullable = false, length = 100)
    private String department;

    /** CGPA on a 10-point scale. */
    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal gpa;

    /** Storage key of the current resume (relative to FILE_STORAGE_PATH). */
    @Column(name = "resume_path", length = 255)
    private String resumePath;

    @Column(name = "resume_original_name", length = 255)
    private String resumeOriginalName;

    @Column(name = "resume_uploaded_at")
    private Instant resumeUploadedAt;
}
