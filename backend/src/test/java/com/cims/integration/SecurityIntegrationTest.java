package com.cims.integration;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import com.cims.entity.Company;
import com.cims.entity.Internship;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.TestData.Account;

class SecurityIntegrationTest extends IntegrationTestBase {

    @Test
    void sqlInjectionAttemptsAreTreatedAsPlainText() throws Exception {
        Account admin = data.admin();
        for (String payload : new String[] {"' OR '1'='1", "1; DROP TABLE users; --", "%' UNION SELECT password_hash FROM users --"}) {
            getWithParams("/api/internships", admin.token(), "q", payload)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalElements").value(0));
            getWithParams("/api/students", admin.token(), "q", payload)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalElements").value(0));
        }
        // The users table still exists and login works.
        getJson("/api/auth/me", admin.token()).andExpect(status().isOk());
    }

    @Test
    void invalidAndUnknownIdsReturnClearErrors() throws Exception {
        Account admin = data.admin();
        getJson("/api/internships/abc", admin.token()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid value 'abc' for parameter 'id'."));
        getJson("/api/internships/999999", admin.token()).andExpect(status().isNotFound());
        getJson("/api/applications/999999", admin.token()).andExpect(status().isNotFound());
        getJson("/api/does-not-exist", admin.token()).andExpect(status().isNotFound());
    }

    @Test
    void facultyCannotAccessAnotherFacultysApplications() throws Exception {
        Account owner = data.faculty();
        Account other = data.faculty();
        Account student = data.student(true);
        Company company = data.company();
        Internship internship = data.openInternship(owner.profileId(), company);
        Long applicationId = data.application(student.profileId(), internship, ApplicationStatus.PENDING).getId();

        getJson("/api/applications/" + applicationId, owner.token()).andExpect(status().isOk());
        getJson("/api/applications/" + applicationId, other.token()).andExpect(status().isForbidden());
        patchJson("/api/applications/" + applicationId + "/status", other.token(),
                com.cims.support.Json.of("status", "SHORTLISTED")).andExpect(status().isForbidden());
        getJson("/api/applications/" + applicationId + "/resume", other.token()).andExpect(status().isForbidden());
        getJson("/api/students/" + student.profileId(), other.token()).andExpect(status().isForbidden());
        // Faculty lists only contain their own internships' applications.
        getJson("/api/applications", other.token()).andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void studentCannotSeeAnotherStudentsApplication() throws Exception {
        Account owner = data.faculty();
        Account applicant = data.student(true);
        Account otherStudent = data.student(true);
        Internship internship = data.openInternship(owner.profileId(), data.company());
        Long applicationId = data.application(applicant.profileId(), internship, ApplicationStatus.PENDING).getId();

        getJson("/api/applications/" + applicationId, otherStudent.token()).andExpect(status().isForbidden());
        deleteJson("/api/applications/" + applicationId, otherStudent.token()).andExpect(status().isForbidden());
    }

    @Test
    void errorResponsesDoNotLeakInternals() throws Exception {
        Account admin = data.admin();
        String body = postJson("/api/companies", admin.token(), "{ not json").andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(body).doesNotContain("Exception").doesNotContain("at com.");
    }
}
