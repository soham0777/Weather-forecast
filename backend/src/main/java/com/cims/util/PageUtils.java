package com.cims.util;

import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Builds a safe {@link Pageable} from request parameters. Only whitelisted sort keys are
 * accepted and page size is capped so clients cannot request thousands of rows at once.
 */
public final class PageUtils {

    public static final int DEFAULT_SIZE = 10;
    public static final int MAX_SIZE = 100;

    private PageUtils() {
    }

    /**
     * @param sort        "key" or "key,asc|desc"; unknown keys fall back to {@code defaultSort}
     * @param allowedKeys map of public sort key to entity property path
     */
    public static Pageable of(Integer page, Integer size, String sort, Map<String, String> allowedKeys, Sort defaultSort) {
        int p = page == null || page < 0 ? 0 : page;
        int s = size == null || size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        return PageRequest.of(p, s, parseSort(sort, allowedKeys, defaultSort));
    }

    private static Sort parseSort(String sort, Map<String, String> allowedKeys, Sort defaultSort) {
        if (sort == null || sort.isBlank()) {
            return defaultSort;
        }
        String[] parts = sort.split(",");
        String property = allowedKeys.get(parts[0].trim());
        if (property == null) {
            return defaultSort;
        }
        Sort.Direction direction = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(direction, property).and(Sort.by(Sort.Direction.DESC, "id"));
    }
}
