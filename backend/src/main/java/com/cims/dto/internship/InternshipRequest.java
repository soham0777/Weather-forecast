package com.cims.dto.internship;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Create/update an internship. {@code durationWeeks} is optional: the server always derives
 * the duration from the dates and rejects a supplied value that does not match.
 * {@code facultyId} is used only when an administrator creates or reassigns an internship.
 */
public record InternshipRequest(
        @NotBlank(message = "Title is required.") @Size(min = 3, max = 150, message = "Title must be between 3 and 150 characters.") String title,
        @NotBlank(message = "Description is required.") @Size(min = 20, max = 5000, message = "Description must be between 20 and 5000 characters.") String description,
        @NotBlank(message = "Domain is required.") @Size(min = 2, max = 100, message = "Domain must be between 2 and 100 characters.") String domain,
        @NotNull(message = "Company is required.") Long companyId,
        Long facultyId,
        Integer durationWeeks,
        @NotNull(message = "Stipend is required (enter 0 for unpaid).")
        @DecimalMin(value = "0.0", message = "Stipend cannot be negative.")
        @DecimalMax(value = "1000000.0", message = "Stipend must not exceed 10,00,000.")
        @Digits(integer = 7, fraction = 2, message = "Stipend can have at most 2 decimal places.") BigDecimal stipend,
        @NotNull(message = "Start date is required.") LocalDate startDate,
        @NotNull(message = "End date is required.") LocalDate endDate,
        @NotNull(message = "Application deadline is required.") LocalDate applicationDeadline) {
}
