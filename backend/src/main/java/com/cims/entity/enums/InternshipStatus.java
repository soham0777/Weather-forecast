package com.cims.entity.enums;

/**
 * Internship lifecycle: PENDING -> APPROVED | REJECTED, APPROVED -> OPEN, OPEN -> CLOSED,
 * and any non-archived internship can be ARCHIVED. See InternshipStatusTransitions.
 */
public enum InternshipStatus {
    PENDING,
    APPROVED,
    REJECTED,
    OPEN,
    CLOSED,
    ARCHIVED
}
