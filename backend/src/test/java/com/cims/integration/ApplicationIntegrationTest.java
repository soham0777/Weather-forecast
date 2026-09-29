package com.cims.integration;

import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;

import com.cims.entity.Internship;
import com.cims.entity.enums.InternshipStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData.Account;

class ApplicationIntegrationTest extends IntegrationTestBase {

    private static final String COVER = "I am excited to apply because this internship matches my skills in Java and React.";

    private static Map<String, Object> apply(Long internshipId) {
        return Json.of("internshipId", internshipId, "coverLetter", COVER, "qualifications", "Java, Spring Boot, React");
    }

    @Test
    void resumeIsMandatory() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(false);
        Internship internship = data.openInternship(faculty.profileId(), data.company());
        postJson("/api/applications", student.token(), apply(internship.getId()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.resume").exists());
    }

    @Test
    void applyPreventsDuplicatesAndBuildsTimeline() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(true);
        Internship internship = data.openInternship(faculty.profileId(), data.company());

        Long id = json(postJson("/api/applications", student.token(), apply(internship.getId()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.application.status").value("PENDING"))
                .andExpect(jsonPath("$.data.timeline[0].title").value("Applied"))
                .andExpect(jsonPath("$.data.actions.canWithdraw").value(true)))
                .path("data").path("application").path("id").asLong();

        postJson("/api/applications", student.token(), apply(internship.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You have already applied for this internship."));

        // Internship list shows the student's application.
        getJson("/api/internships/" + internship.getId(), student.token())
                .andExpect(jsonPath("$.data.myApplicationId").value(id))
                .andExpect(jsonPath("$.data.myApplicationStatus").value("PENDING"));

        // Faculty opens it (Under review), shortlists and accepts.
        getJson("/api/applications/" + id, faculty.token()).andExpect(status().isOk());
        patchJson("/api/applications/" + id + "/status", faculty.token(), Json.of("status", "ACCEPTED"))
                .andExpect(status().isConflict());
        patchJson("/api/applications/" + id + "/status", faculty.token(), Json.of("status", "SHORTLISTED", "comment", "Good profile"))
                .andExpect(status().isOk());
        patchJson("/api/applications/" + id + "/status", faculty.token(), Json.of("status", "ACCEPTED"))
                .andExpect(status().isOk());

        getJson("/api/applications/" + id, student.token())
                .andExpect(jsonPath("$.data.application.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.data.timeline[*].title", hasItems("Applied", "Under review", "Shortlisted", "Accepted")))
                .andExpect(jsonPath("$.data.actions.canWithdraw").value(false));
        deleteJson("/api/applications/" + id, student.token()).andExpect(status().isConflict());
    }

    @Test
    void cannotApplyToUnavailableInternships() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(true);
        Internship pending = data.internship(faculty.profileId(), data.company(), InternshipStatus.PENDING,
                data.today().plusDays(40), data.today().plusDays(100), data.today().plusDays(20));
        postJson("/api/applications", student.token(), apply(pending.getId())).andExpect(status().isConflict());
        Internship expired = data.internship(faculty.profileId(), data.company(), InternshipStatus.OPEN,
                data.today().plusDays(40), data.today().plusDays(100), data.today().minusDays(1));
        postJson("/api/applications", student.token(), apply(expired.getId())).andExpect(status().isConflict());
        postJson("/api/applications", student.token(), apply(999999L)).andExpect(status().isNotFound());
        postJson("/api/applications", student.token(), Json.of("internshipId", pending.getId(), "coverLetter", "too short"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.coverLetter").exists());
    }

    @Test
    void studentCanEditAndWithdrawPendingApplication() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(true);
        Internship internship = data.openInternship(faculty.profileId(), data.company());
        Long id = json(postJson("/api/applications", student.token(), apply(internship.getId())))
                .path("data").path("application").path("id").asLong();

        putJson("/api/applications/" + id, student.token(), Json.of("coverLetter", COVER + " Updated.", "qualifications", "Updated"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.qualifications").value("Updated"));
        deleteJson("/api/applications/" + id, student.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.application.status").value("WITHDRAWN"));
        // Withdrawn applications are kept (not deleted) and still block a second application.
        getJson("/api/applications/" + id, student.token()).andExpect(status().isOk());
        postJson("/api/applications", student.token(), apply(internship.getId())).andExpect(status().isConflict());
        patchJson("/api/applications/" + id + "/status", faculty.token(), Json.of("status", "SHORTLISTED"))
                .andExpect(status().isConflict());
    }

    @Test
    void facultyAndAdminListsAreScoped() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(true);
        Internship internship = data.openInternship(faculty.profileId(), data.company());
        postJson("/api/applications", student.token(), apply(internship.getId())).andExpect(status().isCreated());

        getJson("/api/applications", faculty.token()).andExpect(jsonPath("$.data.totalElements").value(1));
        getJson("/api/applications", student.token()).andExpect(jsonPath("$.data.totalElements").value(1));
        getJson("/api/applications?internshipId=" + internship.getId() + "&status=PENDING", data.admin().token())
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }
}
