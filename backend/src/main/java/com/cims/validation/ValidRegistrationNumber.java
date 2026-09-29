package com.cims.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

/**
 * Company registration number in CIN or LLPIN format (case-insensitive, surrounding spaces
 * ignored). The service stores the upper-case, trimmed value.
 */
@Documented
@Constraint(validatedBy = RegistrationNumberValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidRegistrationNumber {

    String message() default "Registration number must be a 21-character CIN (e.g. U72200MH2009PTC123456) or an LLPIN (e.g. AAB-1234).";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
