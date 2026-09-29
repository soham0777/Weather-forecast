package com.cims.dto.student;

import java.math.BigDecimal;
import java.time.Instant;

/** Full student profile including resume details and application statistics. */
public record StudentProfileDto(Long id, Long userId, String name, String email, String phone, String department,
                                BigDecimal gpa, boolean active, boolean verified, ResumeInfo resume,
                                ApplicationStats applicationStats, int profileCompletion, Instant createdAt,
                                Instant updatedAt) {

    public record ResumeInfo(boolean uploaded, String fileName, Instant uploadedAt) {
    }

    public record ApplicationStats(long total, long pending, long shortlisted, long accepted, long rejected,
                                   long withdrawn) {
    }
}
