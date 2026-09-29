package com.cims.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Service;

import com.cims.config.AppProperties;
import com.cims.entity.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/** Issues and validates HMAC-SHA256 signed JWTs. The secret comes from JWT_SECRET. */
@Service
public class JwtService {

    private static final String ISSUER = "cims";
    private static final int MIN_SECRET_LENGTH = 32;

    private final SecretKey key;
    private final long expirationMinutes;

    public JwtService(AppProperties properties) {
        String secret = properties.jwt().secret();
        if (secret == null || secret.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException("The JWT_SECRET environment variable must be set to a random value of at least "
                    + MIN_SECRET_LENGTH + " characters (e.g. `openssl rand -base64 48`).");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMinutes = properties.jwt().expirationMinutes();
    }

    public IssuedToken generate(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(expirationMinutes, ChronoUnit.MINUTES);
        String token = Jwts.builder()
                .issuer(ISSUER)
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(key)
                .compact();
        return new IssuedToken(token, expiresAt);
    }

    /**
     * Verifies signature, issuer and expiry.
     *
     * @throws io.jsonwebtoken.ExpiredJwtException if the token has expired
     * @throws JwtException for any other invalid token
     */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(ISSUER)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public record IssuedToken(String token, Instant expiresAt) {
    }
}
