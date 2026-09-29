package com.cims.dto.faculty;

import com.cims.validation.ValidEmail;
import com.cims.validation.ValidPhone;
import com.cims.validation.ValidationPatterns;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Admin create/update of a faculty account. {@code password} is required on create only. */
public record FacultyRequest(
        @ValidEmail String email,
        @Pattern(regexp = ValidationPatterns.PASSWORD,
                message = "Password must be at least 8 characters and include upper-case, lower-case, number and special character.")
        String password,
        @NotBlank(message = "Name is required.") @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters.") String name,
        @NotBlank(message = "Department is required.") @Size(max = 100) String department,
        @NotBlank(message = "Designation is required.") @Size(max = 100) String designation,
        @ValidPhone String phone) {

    /** Surrounding whitespace (e.g. from copy-paste) is removed before validation. */
    public FacultyRequest {
        email = email == null ? null : email.trim();
    }
}
