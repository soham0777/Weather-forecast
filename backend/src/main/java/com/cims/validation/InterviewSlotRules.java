package com.cims.validation;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.cims.entity.Internship;
import com.cims.exception.BusinessValidationException;

/**
 * Interview scheduling rules (evaluated in the college time zone):
 * <ol>
 *   <li>the slot cannot be in the past;</li>
 *   <li>the slot must give at least 24 hours' notice;</li>
 *   <li>the slot cannot be after the internship's application deadline (end of that day).</li>
 * </ol>
 */
@Component
public class InterviewSlotRules {

    public static final int MIN_NOTICE_HOURS = 24;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");

    private final Clock clock;

    public InterviewSlotRules(Clock clock) {
        this.clock = clock;
    }

    public void validate(LocalDate date, LocalTime time, Internship internship) {
        LocalDateTime slot = LocalDateTime.of(date, time);
        LocalDateTime now = LocalDateTime.now(clock);
        if (!slot.isAfter(now)) {
            throw new BusinessValidationException("An interview cannot be scheduled in the past.",
                    Map.of("interviewDate", "Choose a future date and time."));
        }
        if (slot.isBefore(now.plusHours(MIN_NOTICE_HOURS))) {
            throw new BusinessValidationException("Interviews must be scheduled with at least 24 hours' notice.",
                    Map.of("interviewDate", "Choose a slot at least 24 hours from now."));
        }
        LocalDate deadline = internship.getApplicationDeadline();
        if (date.isAfter(deadline)) {
            String message = "An interview cannot be scheduled after the internship's application deadline ("
                    + deadline.format(DATE) + ").";
            throw new BusinessValidationException(message, Map.of("interviewDate", message));
        }
    }
}
