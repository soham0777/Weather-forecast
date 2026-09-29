package com.cims.dto.interview;

import com.cims.entity.enums.InterviewResult;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Record the outcome of an interview (marks it COMPLETED). */
public record InterviewResultRequest(
        @NotNull(message = "Result is required.") InterviewResult result,
        @Size(max = 1000, message = "Comments must be at most 1000 characters.") String comments) {
}
