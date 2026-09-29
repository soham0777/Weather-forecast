package com.cims.validation;

import java.util.Locale;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class RegistrationNumberValidator implements ConstraintValidator<ValidRegistrationNumber, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return false;
        }
        return ValidationPatterns.REGISTRATION_NUMBER_PATTERN
                .matcher(value.trim().toUpperCase(Locale.ROOT))
                .matches();
    }
}
