package com.cims.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.cims.entity.enums.InterviewResult;
import com.cims.entity.enums.InterviewStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "interviews")
public class Interview extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    /** Date in the college time zone. */
    @Column(name = "interview_date", nullable = false)
    private LocalDate interviewDate;

    /** Time in the college time zone. */
    @Column(name = "interview_time", nullable = false)
    private LocalTime interviewTime;

    @Column(name = "interviewer_name", nullable = false, length = 100)
    private String interviewerName;

    @Column(name = "interviewer_details", length = 500)
    private String interviewerDetails;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private InterviewStatus status = InterviewStatus.SCHEDULED;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(length = 20)
    private InterviewResult result;

    @Column(length = 1000)
    private String comments;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheduled_by", nullable = false, updatable = false)
    private User scheduledBy;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;
}
