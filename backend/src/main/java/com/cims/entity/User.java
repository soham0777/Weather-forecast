package com.cims.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.cims.entity.enums.Role;

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
@Table(name = "users")
public class User extends BaseEntity {

    /** Always stored trimmed and lower-case. */
    @Column(nullable = false, unique = true, length = 255)
    private String email;

    /** BCrypt hash — never serialised to API responses. */
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "is_verified", nullable = false)
    private boolean verified = false;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;
}
