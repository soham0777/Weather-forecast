package com.cims.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/** Enables {@code @Async} so e-mails are sent without delaying the HTTP response. */
@Configuration
@EnableAsync
public class AsyncConfig {
}
