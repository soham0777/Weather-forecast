package com.cims.dto.application;

import java.time.Instant;

/**
 * One real event in an application's history (never fabricated): status changes from
 * application_status_history, first review, interview events and internship completion.
 */
public record TimelineEventDto(String type, String title, String description, Instant timestamp, String actor) {
}
