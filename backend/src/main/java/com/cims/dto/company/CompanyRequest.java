package com.cims.dto.company;

import com.cims.validation.ValidEmail;
import com.cims.validation.ValidPhone;
import com.cims.validation.ValidRegistrationNumber;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompanyRequest(
        @NotBlank(message = "Company name is required.") @Size(min = 2, max = 150, message = "Company name must be between 2 and 150 characters.") String name,
        @ValidRegistrationNumber String registrationNumber,
        @NotBlank(message = "Location is required.") @Size(max = 150) String location,
        @NotBlank(message = "Contact person is required.") @Size(max = 100) String contactPerson,
        @ValidEmail String contactEmail,
        @ValidPhone String contactPhone) {

    /** Surrounding whitespace (e.g. from copy-paste) is removed before validation. */
    public CompanyRequest {
        contactEmail = contactEmail == null ? null : contactEmail.trim();
        registrationNumber = registrationNumber == null ? null : registrationNumber.trim();
    }
}
