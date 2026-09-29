package com.cims.integration;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import com.cims.entity.Internship;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.support.IntegrationTestBase;
import com.cims.support.TestData.Account;

class ReportIntegrationTest extends IntegrationTestBase {

    @Test
    void reportsAndDashboardsReflectDatabaseState() throws Exception {
        Account faculty = data.faculty();
        Account student = data.student(true);
        Internship finished = data.finishedInternship(faculty.profileId(), data.company());
        data.application(student.profileId(), finished, ApplicationStatus.ACCEPTED);
        Internship open = data.openInternship(faculty.profileId(), data.company());
        data.application(data.student(true).profileId(), open, ApplicationStatus.PENDING);

        getJson("/api/reports/faculty", faculty.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.postedInternships.total").value(2))
                .andExpect(jsonPath("$.data.applicationReview.totalApplications").value(2))
                .andExpect(jsonPath("$.data.applicationReview.pending").value(1))
                .andExpect(jsonPath("$.data.applicationReview.accepted").value(1))
                .andExpect(jsonPath("$.data.interviewStatistics.successRate").doesNotExist());

        getJson("/api/dashboard/faculty", faculty.token())
                .andExpect(jsonPath("$.data.postedInternships").value(2))
                .andExpect(jsonPath("$.data.pendingReviews").value(1))
                .andExpect(jsonPath("$.data.pendingEvaluations").value(1));

        getJson("/api/reports/student", student.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.placement.status").value("PLACED"))
                .andExpect(jsonPath("$.data.placement.offers[0].internshipTitle").value(finished.getTitle()))
                .andExpect(jsonPath("$.data.applications.total").value(1));

        getJson("/api/dashboard/student", student.token())
                .andExpect(jsonPath("$.data.acceptedApplications").value(1))
                .andExpect(jsonPath("$.data.resumeUploaded").value(true));

        Account admin = data.admin();
        getJson("/api/reports/admin", admin.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.placement.studentsPlaced").isNumber())
                .andExpect(jsonPath("$.data.compliance.policyViolations.length()").value(4));
        getJson("/api/dashboard/admin", admin.token()).andExpect(status().isOk());
    }

    @Test
    void newStudentReportShowsNotPlaced() throws Exception {
        Account student = data.student(false);
        getJson("/api/reports/student", student.token())
                .andExpect(jsonPath("$.data.placement.status").value("NOT_PLACED"))
                .andExpect(jsonPath("$.data.placement.offers.length()").value(0))
                .andExpect(jsonPath("$.data.applications.total").value(0));
    }
}
