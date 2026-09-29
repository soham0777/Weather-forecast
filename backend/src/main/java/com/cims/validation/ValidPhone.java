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

/** Required phone number: 10–15 digits with an optional leading "+". */
@Documented
@NotBlank
@Pattern(regexp = ValidationPatterns.PHONE)
@ReportAsSingleViolation
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPhone {

    String message() default "Phone number must contain 10 to 15 digits (an optional leading + is allowed).";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
