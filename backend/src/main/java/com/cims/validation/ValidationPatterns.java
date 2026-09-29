package com.cims.validation;

import java.util.regex.Pattern;

/** Regular expressions shared by the custom validation annotations. */
public final class ValidationPatterns {

    /** Practical e-mail format: local part, "@", domain with a 2+ letter TLD. */
    public static final String EMAIL = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}$";

    /**
     * At least 8 characters with an upper-case letter, a lower-case letter, a digit and a
     * special character. Capped at 64 characters (BCrypt only uses the first 72 bytes).
     */
    public static final String PASSWORD = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).{8,64}$";

    /** 10–15 digits with an optional leading "+" (e.g. 9876543210, +919876543210). */
    public static final String PHONE = "^\\+?[0-9]{10,15}$";

    /**
     * Company registration number format adopted by the system:
     * <ul>
     *   <li>Indian Corporate Identification Number (CIN), 21 characters, e.g. U72200MH2009PTC123456</li>
     *   <li>Limited Liability Partnership Identification Number (LLPIN), e.g. AAB-1234</li>
     * </ul>
     */
    public static final String REGISTRATION_NUMBER = "^([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-[0-9]{4})$";

    public static final Pattern PASSWORD_PATTERN = Pattern.compile(PASSWORD);
    public static final Pattern REGISTRATION_NUMBER_PATTERN = Pattern.compile(REGISTRATION_NUMBER);

    private ValidationPatterns() {
    }
}
