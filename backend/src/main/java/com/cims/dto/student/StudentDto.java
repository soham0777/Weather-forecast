package com.cims.dto.student;

import java.math.BigDecimal;
import java.time.Instant;

import com.cims.entity.Student;
import com.cims.entity.User;

/** Student row for admin lists and faculty views. */
public record StudentDto(Long id, Long userId, String name, String email, String phone, String department,
                         BigDecimal gpa, boolean active, boolean verified, boolean hasResume,
                         Instant resumeUploadedAt, Instant createdAt) {

    public static StudentDto from(Student student) {
        User user = student.getUser();
        return new StudentDto(student.getId(), user.getId(), student.getStudentName(), user.getEmail(),
                student.getPhone(), student.getDepartment(), student.getGpa(), user.isActive(), user.isVerified(),
                student.getResumePath() != null, student.getResumeUploadedAt(), student.getCreatedAt());
    }
}
