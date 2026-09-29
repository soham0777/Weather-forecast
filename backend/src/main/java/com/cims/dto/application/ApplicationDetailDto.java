package com.cims.dto.application;

import java.util.List;

import com.cims.dto.evaluation.EvaluationDto;
import com.cims.dto.feedback.CompanyFeedbackDto;
import com.cims.dto.feedback.StudentFeedbackDto;
import com.cims.dto.interview.InterviewDto;
import com.cims.entity.enums.ApplicationStatus;

public record ApplicationDetailDto(ApplicationDto application, String coverLetter, String qualifications,
                                   List<TimelineEventDto> timeline, List<InterviewDto> interviews,
                                   List<EvaluationDto> evaluations, StudentFeedbackDto studentFeedback,
                                   CompanyFeedbackDto companyFeedback, Actions actions) {

    /** What the current user may do next; the backend enforces the same rules. */
    public record Actions(List<ApplicationStatus> allowedStatusChanges, boolean canEdit, boolean canWithdraw,
                          boolean canScheduleInterview, boolean canMarkCompleted, boolean canEvaluate,
                          boolean canRecordCompanyFeedback, boolean canSubmitStudentFeedback) {
    }
}
