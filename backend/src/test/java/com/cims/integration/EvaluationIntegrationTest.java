package com.cims.integration;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.cims.entity.Internship;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData.Account;

class EvaluationIntegrationTest extends IntegrationTestBase {

    private Account faculty;
    private Account student;
    private Long applicationId;

    @BeforeEach
    void setUp() {
        faculty = data.faculty();
        student = data.student(true);
        Internship internship = data.finishedInternship(faculty.profileId(), data.company());
        applicationId = data.application(student.profileId(), internship, ApplicationStatus.ACCEPTED).getId();
    }

    private Map<String, Object> evaluation(Object rating) {
        return Json.of("applicationId", applicationId, "technicalSkills", rating, "softSkills", rating,
                "punctuality", rating, "responsibility", rating, "teamwork", rating, "learningAbility", rating,
                "overallRating", rating, "comments", "Evaluation comments");
    }

    @Test
    void ratingOfOneIsAccepted() throws Exception {
        postJson("/api/evaluations", faculty.token(), evaluation(1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.overallRating").value(1))
                .andExpect(jsonPath("$.data.averageCriteriaScore").value(1.0));
    }

    @Test
    void ratingOfFiveIsAccepted() throws Exception {
        postJson("/api/evaluations", faculty.token(), evaluation(5))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.technicalSkills").value(5));
    }

    @Test
    void ratingOfZeroIsRejected() throws Exception {
        postJson("/api/evaluations", faculty.token(), evaluation(0))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.technicalSkills").value("Rating is required and must be a whole number from 1 to 5."));
    }

    @Test
    void ratingOfSixIsRejected() throws Exception {
        postJson("/api/evaluations", faculty.token(), evaluation(6)).andExpect(status().isUnprocessableEntity());
    }

    @Test
    void negativeDecimalAndMissingRatingsAreRejected() throws Exception {
        postJson("/api/evaluations", faculty.token(), evaluation(-1)).andExpect(status().isUnprocessableEntity());
        postJson("/api/evaluations", faculty.token(), evaluation(3.5)).andExpect(status().isBadRequest());
        Map<String, Object> missing = evaluation(4);
        missing.remove("overallRating");
        postJson("/api/evaluations", faculty.token(), missing)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.overallRating").exists());
    }

    @Test
    void duplicateUpdateArchiveAndStudentVisibility() throws Exception {
        Long id = json(postJson("/api/evaluations", faculty.token(), evaluation(4)).andExpect(status().isCreated()))
                .path("data").path("id").asLong();
        postJson("/api/evaluations", faculty.token(), evaluation(4)).andExpect(status().isConflict());
        putJson("/api/evaluations/" + id, faculty.token(), evaluation(5))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.overallRating").value(5));
        getJson("/api/evaluations", student.token()).andExpect(jsonPath("$.data.totalElements").value(1));

        deleteJson("/api/evaluations/" + id, faculty.token()).andExpect(status().isOk());
        getJson("/api/evaluations", student.token()).andExpect(jsonPath("$.data.totalElements").value(0));
        // A new evaluation can be recorded after archiving (the archived row is reused).
        postJson("/api/evaluations", faculty.token(), evaluation(3)).andExpect(status().isCreated());
    }

    @Test
    void onlyAcceptedStartedInternshipsCanBeEvaluated() throws Exception {
        Internship open = data.openInternship(faculty.profileId(), data.company());
        Long pending = data.application(data.student(true).profileId(), open, ApplicationStatus.PENDING).getId();
        Map<String, Object> body = evaluation(4);
        body.put("applicationId", pending);
        postJson("/api/evaluations", faculty.token(), body).andExpect(status().isUnprocessableEntity());
        postJson("/api/evaluations", data.faculty().token(), evaluation(4)).andExpect(status().isForbidden());
        body.put("applicationId", 999999L);
        postJson("/api/evaluations", faculty.token(), body).andExpect(status().isNotFound());
    }
}
