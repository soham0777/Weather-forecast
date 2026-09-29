package com.cims.support;

import java.util.LinkedHashMap;
import java.util.Map;

/** Builds JSON request bodies: {@code Json.of("email", "a@b.c", "password", "x")}. */
public final class Json {

    private Json() {
    }

    public static Map<String, Object> of(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put((String) keyValues[i], keyValues[i + 1]);
        }
        return map;
    }
}
