package com.cims.integration;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.cims.entity.Internship;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData.Account;

class InterviewIntegrationTest extends IntegrationTestBase {

    private Account faculty;
    private Account student;
    private Internship internship;
    private Long applicationId;

    @BeforeEach
    void setUp() {
        faculty = data.faculty();
        student = data.student(true);
        internship = data.openInternship(faculty.profileId(), data.company()); // deadline = today + 20
        applicationId = data.application(student.profileId(), internship, ApplicationStatus.SHORTLISTED).getId();
    }

    private Map<String, Object> slot(Long appId, LocalDate date, String time) {
        return Json.of("applicationId", appId, "interviewDate", date.toString(), "interviewTime", time,
                "interviewerName", "Mr. Interviewer", "interviewerDetails", "Online");
    }

    @Test
    void scheduleRescheduleAndCancel() throws Exception {
        Long id = json(postJson("/api/interviews", faculty.token(), slot(applicationId, data.today().plusDays(5), "10:30"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("SCHEDULED")))
                .path("data").path("id").asLong();

        // Only one scheduled interview at a time.
        postJson("/api/interviews", faculty.token(), slot(applicationId, data.today().plusDays(6), "10:30"))
                .andExpect(status().isConflict());

        putJson("/api/interviews/" + id, faculty.token(), Json.of("interviewDate", data.today().plusDays(7).toString(),
                "interviewTime", "15:00", "interviewerName", "Ms. New", "interviewerDetails", "Room 101", "comments", "Moved"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interviewTime").value("15:00:00"))
                .andExpect(jsonPath("$.data.interviewerName").value("Ms. New"));

        // The student sees it as upcoming.
        getJson("/api/interviews?scope=upcoming", student.token()).andExpect(jsonPath("$.data.totalElements").value(1));

        // Result cannot be recorded before the interview happens.
        patchJson("/api/interviews/" + id + "/result", faculty.token(), Json.of("result", "SELECTED"))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/interviews/" + id)
                        .param("reason", "Company request")
                        .header("Authorization", "Bearer " + faculty.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"))
                .andExpect(jsonPath("$.data.comments").value("Company request"));
        deleteJson("/api/interviews/" + id, faculty.token()).andExpect(status().isConflict());
    }

    @Test
    void twentyFourHourNoticeRule() throws Exception {
        LocalDate tomorrow = data.today().plusDays(1);
        // Tomorrow at 00:00 is always less than 24 hours away.
        postJson("/api/interviews", faculty.token(), slot(applicationId, tomorrow, "00:00"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Interviews must be scheduled with at least 24 hours' notice."));
        postJson("/api/interviews", faculty.token(), slot(applicationId, data.today().plusDays(2), "23:00"))
                .andExpect(status().isCreated());
    }

    @Test
    void cannotScheduleInThePast() throws Exception {
        postJson("/api/interviews", faculty.token(), slot(applicationId, data.today().minusDays(1), "10:00"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("An interview cannot be scheduled in the past."));
    }

    @Test
    void cannotScheduleAfterApplicationDeadline() throws Exception {
        LocalDate deadline = internship.getApplicationDeadline();
        postJson("/api/interviews", faculty.token(), slot(applicationId, deadline.plusDays(1), "10:00"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.interviewDate").exists());
        postJson("/api/interviews", faculty.token(), slot(applicationId, deadline, "17:00"))
                .andExpect(status().isCreated());
    }

    @Test
    void interviewMustBelongToAValidShortlistedApplication() throws Exception {
        postJson("/api/interviews", faculty.token(), slot(999999L, data.today().plusDays(5), "10:00"))
                .andExpect(status().isNotFound());
        Long pendingApp = data.application(data.student(true).profileId(), internship, ApplicationStatus.PENDING).getId();
        postJson("/api/interviews", faculty.token(), slot(pendingApp, data.today().plusDays(5), "10:00"))
                .andExpect(status().isConflict());
        postJson("/api/interviews", data.faculty().token(), slot(applicationId, data.today().plusDays(5), "10:00"))
                .andExpect(status().isForbidden());
        postJson("/api/interviews", student.token(), slot(applicationId, data.today().plusDays(5), "10:00"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectingApplicationCancelsScheduledInterview() throws Exception {
        Long id = json(postJson("/api/interviews", faculty.token(), slot(applicationId, data.today().plusDays(5), "11:00")))
                .path("data").path("id").asLong();
        patchJson("/api/applications/" + applicationId + "/status", faculty.token(), Json.of("status", "REJECTED"))
                .andExpect(status().isOk());
        getJson("/api/interviews/" + id, student.token()).andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }
}
