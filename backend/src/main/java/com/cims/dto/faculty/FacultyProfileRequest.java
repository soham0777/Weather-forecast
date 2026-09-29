package com.cims.dto.faculty;

import com.cims.validation.ValidPhone;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Fields a faculty member may edit on their own profile. */
public record FacultyProfileRequest(
        @NotBlank(message = "Name is required.") @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters.") String name,
        @NotBlank(message = "Department is required.") @Size(max = 100) String department,
        @NotBlank(message = "Designation is required.") @Size(max = 100) String designation,
        @ValidPhone String phone) {
}
