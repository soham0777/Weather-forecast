package com.cims.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.cims.entity.enums.CompanyStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "companies")
public class Company extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    /** Upper-case CIN or LLPIN; unique across companies. */
    @Column(name = "registration_number", nullable = false, unique = true, length = 25)
    private String registrationNumber;

    @Column(nullable = false, length = 150)
    private String location;

    @Column(name = "contact_person", nullable = false, length = 100)
    private String contactPerson;

    @Column(name = "contact_email", nullable = false, length = 255)
    private String contactEmail;

    @Column(name = "contact_phone", nullable = false, length = 16)
    private String contactPhone;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private CompanyStatus status = CompanyStatus.ACTIVE;
}
