package com.cims.dto.auth;

import java.math.BigDecimal;

import com.cims.validation.StrongPassword;
import com.cims.validation.ValidEmail;
import com.cims.validation.ValidPhone;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Public student self-registration. */
public record RegisterRequest(
        @ValidEmail String email,
        @StrongPassword String password,
        @NotBlank(message = "Full name is required.")
        @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters.") String name,
        @ValidPhone String phone,
        @NotBlank(message = "Department is required.")
        @Size(max = 100, message = "Department must be at most 100 characters.") String department,
        @NotNull(message = "GPA is required.")
        @DecimalMin(value = "0.0", message = "GPA must be between 0 and 10.")
        @DecimalMax(value = "10.0", message = "GPA must be between 0 and 10.")
        @Digits(integer = 2, fraction = 2, message = "GPA can have at most 2 decimal places.") BigDecimal gpa) {
}
