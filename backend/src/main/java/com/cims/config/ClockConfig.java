package com.cims.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides a single {@link Clock} in the college time zone. All business rules that
 * depend on "today" or "now" (deadlines, 24-hour interview notice) use this clock, so
 * the rules behave the same whether the server runs in UTC or local time.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock(AppProperties properties) {
        return Clock.system(ZoneId.of(properties.timezone()));
    }
}
