package com.cims.integration;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;

import com.cims.entity.Company;
import com.cims.entity.enums.InternshipStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData;
import com.cims.support.TestData.Account;

class CompanyIntegrationTest extends IntegrationTestBase {

    private static Map<String, Object> company(String registrationNumber) {
        return Json.of("name", "Acme Software Pvt Ltd", "registrationNumber", registrationNumber, "location", "Nashik",
                "contactPerson", "Ms. HR", "contactEmail", "hr@acme.example", "contactPhone", "9876543210");
    }

    @Test
    void createReadUpdateCompany() throws Exception {
        Account admin = data.admin();
        String cin = TestData.uniqueCin();
        Long id = json(postJson("/api/companies", admin.token(), company(cin.toLowerCase()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.registrationNumber").value(cin)))
                .path("data").path("id").asLong();

        Map<String, Object> update = company(cin);
        update.put("location", "Pune");
        putJson("/api/companies/" + id, admin.token(), update)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.location").value("Pune"));
        getJson("/api/companies/" + id, admin.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.company.name").value("Acme Software Pvt Ltd"))
                .andExpect(jsonPath("$.data.ratings.feedbackCount").value(0));
    }

    @Test
    void registrationNumberMustBeValidAndUnique() throws Exception {
        Account admin = data.admin();
        postJson("/api/companies", admin.token(), company("12345"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.registrationNumber").exists());
        postJson("/api/companies", admin.token(), company("AAB-1234X")).andExpect(status().isUnprocessableEntity());

        String cin = TestData.uniqueCin();
        postJson("/api/companies", admin.token(), company(cin)).andExpect(status().isCreated());
        postJson("/api/companies", admin.token(), company(cin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("A company with this registration number already exists."));
    }

    @Test
    void studentsSeeCompaniesWithoutPrivateDetails() throws Exception {
        Account student = data.student(false);
        Company company = data.company();
        getJson("/api/companies/" + company.getId(), student.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.company.name").value(company.getName()))
                .andExpect(jsonPath("$.data.company.contactEmail").doesNotExist())
                .andExpect(jsonPath("$.data.company.registrationNumber").doesNotExist());
    }

    @Test
    void deleteArchivesCompaniesWithInternships() throws Exception {
        Account admin = data.admin();
        Account faculty = data.faculty();

        Company unused = data.company();
        deleteJson("/api/companies/" + unused.getId(), admin.token())
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Company deleted."));

        Company withOpen = data.company();
        data.openInternship(faculty.profileId(), withOpen);
        deleteJson("/api/companies/" + withOpen.getId(), admin.token()).andExpect(status().isConflict());

        Company withClosed = data.company();
        data.internship(faculty.profileId(), withClosed, InternshipStatus.CLOSED, data.today().minusDays(60),
                data.today().minusDays(10), data.today().minusDays(70));
        deleteJson("/api/companies/" + withClosed.getId(), admin.token())
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Company archived."));
        getJson("/api/companies/" + withClosed.getId(), admin.token())
                .andExpect(jsonPath("$.data.company.status").value("ARCHIVED"));
        patchJson("/api/companies/" + withClosed.getId() + "/restore", admin.token(), Json.of())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }
}
