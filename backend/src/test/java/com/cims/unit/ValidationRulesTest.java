package com.cims.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.cims.entity.Internship;
import com.cims.exception.BusinessValidationException;
import com.cims.validation.InternshipDateRules;
import com.cims.validation.InterviewSlotRules;
import com.cims.validation.ValidationPatterns;

/** Pure unit tests of the validation rules with a fixed clock (no Spring context). */
class ValidationRulesTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    /** Fixed "now": 1 July 2026, 10:00 IST. */
    private static final Clock CLOCK = Clock.fixed(ZonedDateTime.of(2026, 7, 1, 10, 0, 0, 0, IST).toInstant(), IST);
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 1);

    @ParameterizedTest
    @ValueSource(strings = {"Bhakti@123", "Aa1!aaaa", "Str0ng#Password"})
    void strongPasswordsMatch(String password) {
        assertThat(ValidationPatterns.PASSWORD_PATTERN.matcher(password).matches()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"bhakti@123", "BHAKTI@123", "Bhakti@abc", "Bhakti1234", "Bh@1", ""})
    void weakPasswordsDoNotMatch(String password) {
        assertThat(ValidationPatterns.PASSWORD_PATTERN.matcher(password).matches()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"U72200MH2015PTC261234", "L45200MH2001PLC130987", "AAB-1234"})
    void validRegistrationNumbers(String value) {
        assertThat(ValidationPatterns.REGISTRATION_NUMBER_PATTERN.matcher(value).matches()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"12345", "X72200MH2015PTC261234", "U72200MH2015PTC26123", "AB-1234", "AAB1234"})
    void invalidRegistrationNumbers(String value) {
        assertThat(ValidationPatterns.REGISTRATION_NUMBER_PATTERN.matcher(value).matches()).isFalse();
    }

    @Test
    void internshipDurationBoundaries() {
        InternshipDateRules rules = new InternshipDateRules(CLOCK);
        LocalDate start = TODAY.plusDays(30);
        assertThat(rules.validate(start, start.plusWeeks(4), TODAY.plusDays(10), null, true, true)).isEqualTo(4);
        assertThat(rules.validate(start, start.plusMonths(6), TODAY.plusDays(10), null, true, true)).isEqualTo(26);
        assertThatThrownBy(() -> rules.validate(start, start.plusDays(27), TODAY.plusDays(10), null, true, true))
                .isInstanceOf(BusinessValidationException.class);
        assertThatThrownBy(() -> rules.validate(start, start.plusMonths(6).plusDays(1), TODAY.plusDays(10), null, true, true))
                .isInstanceOf(BusinessValidationException.class);
        assertThatThrownBy(() -> rules.validate(start, start.plusWeeks(8), TODAY.plusDays(10), 9, true, true))
                .isInstanceOf(BusinessValidationException.class)
                .hasMessageContaining("does not match");
        assertThatThrownBy(() -> rules.validate(TODAY, TODAY.plusWeeks(8), TODAY, null, true, true))
                .isInstanceOf(BusinessValidationException.class);
    }

    @Test
    void interviewSlotRules() {
        InterviewSlotRules rules = new InterviewSlotRules(CLOCK);
        Internship internship = new Internship();
        internship.setApplicationDeadline(TODAY.plusDays(10));

        // exactly 24 hours ahead is allowed; one minute less is not
        rules.validate(TODAY.plusDays(1), LocalTime.of(10, 0), internship);
        assertThatThrownBy(() -> rules.validate(TODAY.plusDays(1), LocalTime.of(9, 59), internship))
                .hasMessageContaining("24 hours");
        assertThatThrownBy(() -> rules.validate(TODAY, LocalTime.of(9, 0), internship))
                .hasMessageContaining("past");
        // on the deadline day is allowed; the day after is not
        rules.validate(TODAY.plusDays(10), LocalTime.of(18, 0), internship);
        assertThatThrownBy(() -> rules.validate(TODAY.plusDays(11), LocalTime.of(10, 0), internship))
                .hasMessageContaining("application deadline");
    }
}
