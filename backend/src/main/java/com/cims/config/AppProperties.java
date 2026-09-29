package com.cims.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * Strongly typed application settings bound from the {@code app.*} properties.
 * Every value can be supplied through environment variables (see application.yml).
 */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @NotBlank String timezone,
        @NotBlank String frontendUrl,
        @Valid @NotNull Cors cors,
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull Storage storage,
        @Valid @NotNull Mail mail) {

    public record Cors(@NotEmpty List<String> allowedOrigins) {
    }

    public record Jwt(String secret, @Min(5) long expirationMinutes) {
    }

    public record Storage(@NotBlank String path) {
    }

    public record Mail(boolean enabled, @NotBlank String from) {
    }
}
