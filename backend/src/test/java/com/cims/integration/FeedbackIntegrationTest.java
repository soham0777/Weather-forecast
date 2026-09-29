package com.cims.integration;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.cims.entity.Internship;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData.Account;

class FeedbackIntegrationTest extends IntegrationTestBase {

    private Account faculty;
    private Account student;
    private Internship finished;
    private Long applicationId;

    @BeforeEach
    void setUp() {
        faculty = data.faculty();
        student = data.student(true);
        finished = data.finishedInternship(faculty.profileId(), data.company());
        applicationId = data.application(student.profileId(), finished, ApplicationStatus.ACCEPTED).getId();
    }

    @Test
    void studentFeedbackAfterCompletedInternship() throws Exception {
        var body = Json.of("applicationId", applicationId, "companyCulture", 5, "mentorshipQuality", 4,
                "technicalLearning", 5, "workEnvironment", 4, "overallExperience", 5, "comments", "Great", "suggestions", "More projects");
        postJson("/api/feedback/student", student.token(), body)
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.overallExperience").value(5));
        postJson("/api/feedback/student", student.token(), body).andExpect(status().isConflict());
        getJson("/api/companies/" + finished.getCompany().getId(), student.token())
                .andExpect(jsonPath("$.data.ratings.feedbackCount").value(1))
                .andExpect(jsonPath("$.data.ratings.overallExperience").value(5.0))
                .andExpect(jsonPath("$.data.recentFeedback[0].studentName").doesNotExist());
    }

    @Test
    void studentFeedbackRatingsValidatedAndRequireFinishedInternship() throws Exception {
        postJson("/api/feedback/student", student.token(), Json.of("applicationId", applicationId, "companyCulture", 6,
                "mentorshipQuality", 4, "technicalLearning", 5, "workEnvironment", 4, "overallExperience", 0))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.companyCulture").exists())
                .andExpect(jsonPath("$.errors.overallExperience").exists());

        Internship open = data.openInternship(faculty.profileId(), data.company());
        Long pending = data.application(student.profileId(), open, ApplicationStatus.PENDING).getId();
        postJson("/api/feedback/student", student.token(), Json.of("applicationId", pending, "companyCulture", 5,
                "mentorshipQuality", 4, "technicalLearning", 5, "workEnvironment", 4, "overallExperience", 5))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void companyFeedbackRecordedByFaculty() throws Exception {
        var body = Json.of("applicationId", applicationId, "companyRepresentative", "HR Lead", "technicalSkills", 5,
                "softSkills", 4, "punctuality", 5, "responsibility", 4, "teamwork", 5, "learningAbility", 4,
                "hireLikelihood", 5, "strengths", "Coding", "areasForImprovement", "Communication", "comments", "Hire");
        postJson("/api/feedback/company", student.token(), body).andExpect(status().isForbidden());
        postJson("/api/feedback/company", faculty.token(), body)
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.hireLikelihood").value(5));
        getJson("/api/feedback/company", student.token()).andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void facultyFeedbackOnOwnInternship() throws Exception {
        var body = Json.of("internshipId", finished.getId(), "courseSuitability", 5, "learningOutcomes", 4,
                "internshipQuality", 5, "learningOutcomesNotes", "Applied DBMS concepts", "suggestions", "Longer duration");
        postJson("/api/feedback/faculty", data.faculty().token(), body).andExpect(status().isForbidden());
        postJson("/api/feedback/faculty", faculty.token(), body).andExpect(status().isCreated());
        postJson("/api/feedback/faculty", faculty.token(), body).andExpect(status().isConflict());
        getJson("/api/feedback/faculty", student.token()).andExpect(status().isForbidden());
    }

    @Test
    void systemFeedbackLifecycle() throws Exception {
        Account admin = data.admin();
        Long id = json(postJson("/api/feedback/system", student.token(), Json.of("feedbackType", "BUG_REPORT",
                "title", "Button not working", "description", "The apply button does nothing on Safari."))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("OPEN")))
                .path("data").path("id").asLong();
        postJson("/api/feedback/system", student.token(), Json.of("feedbackType", "SPAM", "title", "Hello", "description", "Hello world"))
                .andExpect(status().isBadRequest());

        patchJson("/api/feedback/system/" + id + "/status", student.token(), Json.of("status", "RESOLVED"))
                .andExpect(status().isForbidden());
        patchJson("/api/feedback/system/" + id + "/status", admin.token(), Json.of("status", "IN_PROGRESS", "adminResponse", "Looking into it"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.adminResponse").value("Looking into it"));
        putJson("/api/feedback/system/" + id, student.token(), Json.of("feedbackType", "BUG_REPORT",
                "title", "Edited title", "description", "Edited description text"))
                .andExpect(status().isConflict());
        getJson("/api/feedback/system", student.token()).andExpect(jsonPath("$.data.totalElements").value(1));
    }
}
