package com.cims.integration;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.cims.entity.Company;
import com.cims.entity.Internship;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.InternshipStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData.Account;

class InternshipIntegrationTest extends IntegrationTestBase {

    private Map<String, Object> request(Long companyId, LocalDate start, LocalDate end, LocalDate deadline) {
        return Json.of("title", "Backend Developer Intern", "description", "Build REST APIs with Spring Boot and MySQL.",
                "domain", "Web Development", "companyId", companyId, "stipend", 12000,
                "startDate", start.toString(), "endDate", end.toString(), "applicationDeadline", deadline.toString());
    }

    private Map<String, Object> validRequest(Long companyId) {
        LocalDate t = data.today();
        return request(companyId, t.plusDays(30), t.plusDays(30 + 84), t.plusDays(15));
    }

    @Test
    void facultyCreatesPendingInternshipAndAdminApprovesAndOpensIt() throws Exception {
        Account faculty = data.faculty();
        Account admin = data.admin();
        Account student = data.student(false);
        Company company = data.company();

        Long id = json(postJson("/api/internships", faculty.token(), validRequest(company.getId()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.durationWeeks").value(12))
                .andExpect(jsonPath("$.message").value("Internship submitted for admin approval.")))
                .path("data").path("id").asLong();

        // Students cannot see pending internships.
        getJson("/api/internships/" + id, student.token()).andExpect(status().isNotFound());

        // Faculty cannot approve.
        patchJson("/api/internships/" + id + "/status", faculty.token(), Json.of("status", "APPROVED"))
                .andExpect(status().isForbidden());
        // Rejection needs remarks.
        patchJson("/api/internships/" + id + "/status", admin.token(), Json.of("status", "REJECTED"))
                .andExpect(status().isUnprocessableEntity());

        patchJson("/api/internships/" + id + "/status", admin.token(), Json.of("status", "APPROVED", "remarks", "Looks good"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
        patchJson("/api/internships/" + id + "/status", faculty.token(), Json.of("status", "OPEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OPEN"))
                .andExpect(jsonPath("$.data.acceptingApplications").value(true));

        getJson("/api/internships/" + id, student.token()).andExpect(status().isOk());
        // Invalid transition
        patchJson("/api/internships/" + id + "/status", admin.token(), Json.of("status", "APPROVED"))
                .andExpect(status().isConflict());
    }

    @Test
    void rejectedInternshipReturnsToPendingWhenEdited() throws Exception {
        Account faculty = data.faculty();
        Account admin = data.admin();
        Company company = data.company();
        Long id = json(postJson("/api/internships", faculty.token(), validRequest(company.getId()))).path("data").path("id").asLong();
        patchJson("/api/internships/" + id + "/status", admin.token(), Json.of("status", "REJECTED", "remarks", "Add details"))
                .andExpect(jsonPath("$.data.status").value("REJECTED"));
        putJson("/api/internships/" + id, faculty.token(), validRequest(company.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    @Test
    void dateRulesAreEnforced() throws Exception {
        Account faculty = data.faculty();
        Long companyId = data.company().getId();
        LocalDate t = data.today();

        // start date in the past
        postJson("/api/internships", faculty.token(), request(companyId, t.minusDays(1), t.plusDays(60), t.minusDays(5)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.startDate").exists());
        // end before start
        postJson("/api/internships", faculty.token(), request(companyId, t.plusDays(60), t.plusDays(30), t.plusDays(10)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.endDate").value("End date must be after the start date."));
        // shorter than 4 weeks
        postJson("/api/internships", faculty.token(), request(companyId, t.plusDays(30), t.plusDays(50), t.plusDays(10)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.endDate").value("Internship duration must be at least 4 weeks."));
        // longer than 6 months
        postJson("/api/internships", faculty.token(), request(companyId, t.plusDays(30), t.plusDays(30).plusMonths(6).plusDays(1), t.plusDays(10)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.endDate").value("Internship duration must not exceed 6 months."));
        // deadline after start
        postJson("/api/internships", faculty.token(), request(companyId, t.plusDays(30), t.plusDays(90), t.plusDays(31)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.applicationDeadline").exists());
        // duration that conflicts with the dates
        Map<String, Object> mismatch = validRequest(companyId);
        mismatch.put("durationWeeks", 20);
        postJson("/api/internships", faculty.token(), mismatch)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.durationWeeks").exists());
        // exactly 4 weeks and exactly 6 months are accepted
        postJson("/api/internships", faculty.token(), request(companyId, t.plusDays(30), t.plusDays(58), t.plusDays(10)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.durationWeeks").value(4));
        postJson("/api/internships", faculty.token(), request(companyId, t.plusDays(30), t.plusDays(30).plusMonths(6), t.plusDays(10)))
                .andExpect(status().isCreated());
    }

    @Test
    void facultyCannotManageOtherFacultysInternship() throws Exception {
        Account owner = data.faculty();
        Account other = data.faculty();
        Company company = data.company();
        Internship internship = data.openInternship(owner.profileId(), company);
        putJson("/api/internships/" + internship.getId(), other.token(), validRequest(company.getId()))
                .andExpect(status().isForbidden());
        patchJson("/api/internships/" + internship.getId() + "/status", other.token(), Json.of("status", "CLOSED"))
                .andExpect(status().isForbidden());
        deleteJson("/api/internships/" + internship.getId(), other.token()).andExpect(status().isForbidden());
    }

    @Test
    void searchFilterAndPagination() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(false);
        Company company = data.company();
        Internship a = data.openInternship(faculty.profileId(), company);
        Internship b = data.openInternship(faculty.profileId(), company);
        data.internship(faculty.profileId(), company, InternshipStatus.PENDING, data.today().plusDays(40),
                data.today().plusDays(100), data.today().plusDays(20));

        String byCompany = "/api/internships?companyId=" + company.getId();
        getJson(byCompany, student.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2)); // pending one hidden
        getJson(byCompany + "&size=1&page=1", student.token())
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.page").value(1));
        getJson("/api/internships?q=" + a.getTitle().substring(a.getTitle().length() - 6), student.token())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(a.getId()));
        getWithParams("/api/internships", student.token(), "q", company.getName())
                .andExpect(jsonPath("$.data.totalElements").value(2));
        getWithParams("/api/internships", student.token(), "companyId", String.valueOf(company.getId()),
                "domain", "web development", "location", "pune", "minStipend", "10000", "maxStipend", "10000")
                .andExpect(jsonPath("$.data.totalElements").value(2));
        getJson(byCompany + "&minStipend=15000", student.token())
                .andExpect(jsonPath("$.data.totalElements").value(0));
        getJson(byCompany + "&minStipend=500&maxStipend=100", student.token())
                .andExpect(status().isUnprocessableEntity());
        getJson(byCompany + "&sort=stipend,desc", student.token()).andExpect(status().isOk());
        // Admin sees the pending one too.
        getJson(byCompany, data.admin().token()).andExpect(jsonPath("$.data.totalElements").value(3));
        org.assertj.core.api.Assertions.assertThat(b.getId()).isNotNull();
    }

    @Test
    void deleteRespectsDependencies() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(true);
        Company company = data.company();

        Long pendingId = json(postJson("/api/internships", faculty.token(), validRequest(company.getId()))).path("data").path("id").asLong();
        deleteJson("/api/internships/" + pendingId, faculty.token())
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Internship deleted."));
        getJson("/api/internships/" + pendingId, faculty.token()).andExpect(status().isNotFound());

        Internship open = data.openInternship(faculty.profileId(), company);
        data.application(student.profileId(), open, ApplicationStatus.PENDING);
        deleteJson("/api/internships/" + open.getId(), faculty.token()).andExpect(status().isConflict());

        Internship closed = data.internship(faculty.profileId(), company, InternshipStatus.CLOSED, data.today().minusDays(60),
                data.today().minusDays(10), data.today().minusDays(70));
        data.application(student.profileId(), closed, ApplicationStatus.REJECTED);
        deleteJson("/api/internships/" + closed.getId(), faculty.token())
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Internship archived."));
        getJson("/api/internships/" + closed.getId(), faculty.token()).andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }
}
