package com.cims.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Password policy: 8+ chars with upper-case, lower-case, digit and special character. */
@Documented
@NotBlank
@Pattern(regexp = ValidationPatterns.PASSWORD)
@ReportAsSingleViolation
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {

    String message() default "Password must be at least 8 characters and include upper-case, lower-case, number and special character.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
