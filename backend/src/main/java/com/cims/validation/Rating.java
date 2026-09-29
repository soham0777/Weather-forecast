package com.cims.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Mandatory integer rating from 1 to 5. Decimal values are rejected earlier by Jackson
 * ({@code spring.jackson.deserialization.accept-float-as-int=false}).
 */
@Documented
@NotNull
@Min(1)
@Max(5)
@ReportAsSingleViolation
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface Rating {

    String message() default "Rating is required and must be a whole number from 1 to 5.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
