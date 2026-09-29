package com.cims.dto.student;

import java.math.BigDecimal;

import com.cims.validation.ValidEmail;
import com.cims.validation.ValidPhone;
import com.cims.validation.ValidationPatterns;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Admin create/update of a student record. {@code password} is required when creating and
 * ignored when updating (users change their own password).
 */
public record AdminStudentRequest(
        @ValidEmail String email,
        @Pattern(regexp = ValidationPatterns.PASSWORD,
                message = "Password must be at least 8 characters and include upper-case, lower-case, number and special character.")
        String password,
        @NotBlank(message = "Full name is required.")
        @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters.") String name,
        @ValidPhone String phone,
        @NotBlank(message = "Department is required.")
        @Size(max = 100, message = "Department must be at most 100 characters.") String department,
        @NotNull(message = "GPA is required.")
        @DecimalMin(value = "0.0", message = "GPA must be between 0 and 10.")
        @DecimalMax(value = "10.0", message = "GPA must be between 0 and 10.")
        @Digits(integer = 2, fraction = 2, message = "GPA can have at most 2 decimal places.") BigDecimal gpa) {

    /** Surrounding whitespace (e.g. from copy-paste) is removed before validation. */
    public AdminStudentRequest {
        email = email == null ? null : email.trim();
    }
}
