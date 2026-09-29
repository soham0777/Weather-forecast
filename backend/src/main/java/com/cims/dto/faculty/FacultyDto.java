package com.cims.dto.faculty;

import java.time.Instant;

import com.cims.entity.Faculty;
import com.cims.entity.User;

public record FacultyDto(Long id, Long userId, String name, String email, String department, String designation,
                         String phone, boolean active, boolean verified, long internshipCount, Instant createdAt) {

    public static FacultyDto from(Faculty faculty, long internshipCount) {
        User user = faculty.getUser();
        return new FacultyDto(faculty.getId(), user.getId(), faculty.getName(), user.getEmail(), faculty.getDepartment(),
                faculty.getDesignation(), faculty.getPhone(), user.isActive(), user.isVerified(), internshipCount,
                faculty.getCreatedAt());
    }
}
