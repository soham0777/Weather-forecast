package com.cims.dto.company;

import java.time.Instant;

import com.cims.entity.Company;
import com.cims.entity.enums.CompanyStatus;

/**
 * Company as returned by the API. Registration and contact details are only included for
 * staff (admin/faculty); students receive {@code null} for those fields.
 */
public record CompanyDto(Long id, String name, String registrationNumber, String location, String contactPerson,
                         String contactEmail, String contactPhone, CompanyStatus status, long internshipCount,
                         Instant createdAt, Instant updatedAt) {

    public static CompanyDto from(Company c, long internshipCount, boolean includePrivateDetails) {
        return new CompanyDto(c.getId(), c.getName(),
                includePrivateDetails ? c.getRegistrationNumber() : null,
                c.getLocation(),
                includePrivateDetails ? c.getContactPerson() : null,
                includePrivateDetails ? c.getContactEmail() : null,
                includePrivateDetails ? c.getContactPhone() : null,
                c.getStatus(), internshipCount, c.getCreatedAt(), c.getUpdatedAt());
    }
}
