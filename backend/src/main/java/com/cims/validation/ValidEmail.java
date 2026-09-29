package com.cims.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Required, well-formed e-mail address (max 255 characters). */
@Documented
@NotBlank
@Size(max = 255)
@Email(regexp = ValidationPatterns.EMAIL)
@ReportAsSingleViolation
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidEmail {

    String message() default "Please enter a valid e-mail address (e.g. name@college.edu).";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
