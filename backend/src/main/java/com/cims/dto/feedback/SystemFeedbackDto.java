package com.cims.dto.feedback;

import java.time.Instant;

import com.cims.entity.SystemFeedback;
import com.cims.entity.enums.Role;
import com.cims.entity.enums.SystemFeedbackStatus;
import com.cims.entity.enums.SystemFeedbackType;

public record SystemFeedbackDto(Long id, SystemFeedbackType feedbackType, String title, String description,
                                SystemFeedbackStatus status, String adminResponse, Long submittedById,
                                String submittedByEmail, Role submittedByRole, String handledByEmail,
                                Instant createdAt, Instant updatedAt) {

    public static SystemFeedbackDto from(SystemFeedback f) {
        return new SystemFeedbackDto(f.getId(), f.getFeedbackType(), f.getTitle(), f.getDescription(), f.getStatus(),
                f.getAdminResponse(), f.getSubmittedBy().getId(), f.getSubmittedBy().getEmail(),
                f.getSubmittedBy().getRole(), f.getHandledBy() != null ? f.getHandledBy().getEmail() : null,
                f.getCreatedAt(), f.getUpdatedAt());
    }
}
