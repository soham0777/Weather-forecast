package com.cims.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import com.cims.config.AppProperties;
import com.cims.entity.EmailVerificationToken;
import com.cims.entity.User;
import com.cims.entity.enums.AuditAction;
import com.cims.exception.BadRequestException;
import com.cims.repository.EmailVerificationTokenRepository;

/**
 * Issues single-use e-mail verification tokens (valid for 24 hours) and verifies them.
 * The raw token only exists in the e-mailed link; the database stores its SHA-256 hash.
 */
@Service
public class EmailVerificationService {

    private static final Duration TOKEN_VALIDITY = Duration.ofHours(24);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailVerificationTokenRepository tokenRepository;
    private final EmailService emailService;
    private final AuditService auditService;
    private final AppProperties properties;

    public EmailVerificationService(EmailVerificationTokenRepository tokenRepository, EmailService emailService,
                                    AuditService auditService, AppProperties properties) {
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
        this.auditService = auditService;
        this.properties = properties;
    }

    @Transactional
    public void sendVerification(User user, String displayName) {
        Instant now = Instant.now();
        tokenRepository.expireActiveTokens(user.getId(), now);

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        EmailVerificationToken token = new EmailVerificationToken();
        token.setUser(user);
        token.setTokenHash(sha256(rawToken));
        token.setExpiresAt(now.plus(TOKEN_VALIDITY));
        tokenRepository.save(token);

        String link = UriComponentsBuilder.fromUriString(properties.frontendUrl())
                .path("/verify-email")
                .queryParam("token", rawToken)
                .toUriString();
        emailService.sendVerificationEmail(user.getEmail(), displayName, link);
    }

    @Transactional
    public void verify(String rawToken) {
        EmailVerificationToken token = tokenRepository.findByTokenHash(sha256(rawToken.trim()))
                .orElseThrow(() -> new BadRequestException("This verification link is invalid."));
        User user = token.getUser();
        if (token.getUsedAt() != null) {
            if (user.isVerified()) {
                return;
            }
            throw new BadRequestException("This verification link has already been used.");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("This verification link has expired. Please log in and request a new one.");
        }
        token.setUsedAt(Instant.now());
        user.setVerified(true);
        auditService.logForUser(user.getId(), AuditAction.EMAIL_VERIFIED, "User", user.getId(), user.getEmail());
    }

    static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
