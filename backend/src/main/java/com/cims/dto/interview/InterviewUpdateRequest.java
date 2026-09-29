package com.cims.dto.interview;

import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Reschedule / edit a scheduled interview. */
public record InterviewUpdateRequest(
        @NotNull(message = "Interview date is required.") LocalDate interviewDate,
        @NotNull(message = "Interview time is required.") LocalTime interviewTime,
        @NotBlank(message = "Interviewer name is required.") @Size(max = 100) String interviewerName,
        @Size(max = 500, message = "Interviewer details must be at most 500 characters.") String interviewerDetails,
        @Size(max = 1000, message = "Comments must be at most 1000 characters.") String comments) {
}
