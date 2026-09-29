package com.cims.util;

import java.util.Locale;

/** Small helpers for normalising user input. */
public final class TextUtils {

    private TextUtils() {
    }

    /** Trims and lower-cases an e-mail address (null-safe). */
    public static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    /** Trims a value and converts blank strings to null. */
    public static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Builds a case-insensitive LIKE pattern ("%value%") or null for blank input. */
    public static String likePattern(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        String escaped = trimmed.toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
