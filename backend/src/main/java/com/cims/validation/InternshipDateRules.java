package com.cims.validation;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.cims.exception.BusinessValidationException;

/**
 * Date rules for internships:
 * <ul>
 *   <li>start date before end date;</li>
 *   <li>duration between 4 weeks and 6 months;</li>
 *   <li>application deadline before the start date;</li>
 *   <li>new or changed start dates / deadlines must not be in the past.</li>
 * </ul>
 * The duration in weeks is always derived from the dates; a supplied value must agree with them.
 */
@Component
public class InternshipDateRules {

    public static final int MIN_WEEKS = 4;
    public static final int MAX_MONTHS = 6;

    private final Clock clock;

    public InternshipDateRules(Clock clock) {
        this.clock = clock;
    }

    /**
     * @param checkStartInFuture    true when the start date is new or has changed
     * @param checkDeadlineInFuture true when the deadline is new or has changed
     * @return the duration in whole weeks
     */
    public int validate(LocalDate start, LocalDate end, LocalDate deadline, Integer suppliedWeeks,
                        boolean checkStartInFuture, boolean checkDeadlineInFuture) {
        LocalDate today = LocalDate.now(clock);
        Map<String, String> errors = new LinkedHashMap<>();

        if (checkStartInFuture && !start.isAfter(today)) {
            errors.put("startDate", "Start date must be in the future.");
        }
        if (checkDeadlineInFuture && deadline.isBefore(today)) {
            errors.put("applicationDeadline", "Application deadline cannot be in the past.");
        }
        if (!start.isBefore(end)) {
            errors.put("endDate", "End date must be after the start date.");
        } else {
            long days = ChronoUnit.DAYS.between(start, end);
            if (days < MIN_WEEKS * 7L) {
                errors.put("endDate", "Internship duration must be at least " + MIN_WEEKS + " weeks.");
            } else if (end.isAfter(start.plusMonths(MAX_MONTHS))) {
                errors.put("endDate", "Internship duration must not exceed " + MAX_MONTHS + " months.");
            }
        }
        if (!deadline.isBefore(start)) {
            errors.putIfAbsent("applicationDeadline", "Application deadline must be before the start date.");
        }

        int weeks = (int) (ChronoUnit.DAYS.between(start, end) / 7);
        if (errors.isEmpty() && suppliedWeeks != null && suppliedWeeks != weeks) {
            errors.put("durationWeeks", "Duration (" + suppliedWeeks + " weeks) does not match the selected dates ("
                    + weeks + " weeks).");
        }
        if (!errors.isEmpty()) {
            String message = errors.size() == 1 ? errors.values().iterator().next() : "Please correct the internship dates.";
            throw new BusinessValidationException(message, errors);
        }
        return weeks;
    }
}
