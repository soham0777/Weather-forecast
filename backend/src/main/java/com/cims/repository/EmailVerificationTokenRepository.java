package com.cims.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.EmailVerificationToken;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    /** Expires every still-usable token of a user (used before issuing a new one). */
    @Modifying
    @Query("update EmailVerificationToken t set t.expiresAt = :now where t.user.id = :userId and t.usedAt is null and t.expiresAt > :now")
    int expireActiveTokens(@Param("userId") Long userId, @Param("now") Instant now);
}
