package com.cims.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData;
import com.cims.support.TestData.Account;

class StudentIntegrationTest extends IntegrationTestBase {

    private ResultActions upload(String token, MockMultipartFile file) throws Exception {
        return mvc.perform(multipart("/api/students/me/resume").file(file)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    @Test
    void studentViewsAndUpdatesOwnProfile() throws Exception {
        Account student = data.student(false);
        getJson("/api/students/me", student.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(student.user().getEmail()))
                .andExpect(jsonPath("$.data.resume.uploaded").value(false))
                .andExpect(jsonPath("$.data.applicationStats.total").value(0));

        putJson("/api/students/me", student.token(), Json.of("name", "Updated Name", "phone", "+919812345678",
                "department", "Information Technology", "gpa", 9.25))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Updated Name"))
                .andExpect(jsonPath("$.data.gpa").value(9.25));
    }

    @Test
    void profileUpdateValidatesInput() throws Exception {
        Account student = data.student(false);
        putJson("/api/students/me", student.token(), Json.of("name", "", "phone", "12ab", "department", "IT", "gpa", 11))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.phone").exists())
                .andExpect(jsonPath("$.errors.gpa").exists());
    }

    @Test
    void validPdfResumeUploadAndDownload() throws Exception {
        Account student = data.student(false);
        upload(student.token(), new MockMultipartFile("file", "My Resume.pdf", "application/pdf", TestData.PDF))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resume.uploaded").value(true))
                .andExpect(jsonPath("$.data.resume.fileName").value("My Resume.pdf"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/students/me/resume")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student.token()))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"));
        // Replacing the resume works as well.
        upload(student.token(), new MockMultipartFile("file", "v2.pdf", "application/pdf", TestData.PDF))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resume.fileName").value("v2.pdf"));
    }

    @Test
    void nonPdfResumeIsRejected() throws Exception {
        Account student = data.student(false);
        upload(student.token(), new MockMultipartFile("file", "resume.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "hello".getBytes()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only PDF files are allowed. Please upload your resume as a .pdf file."));
        upload(student.token(), new MockMultipartFile("file", "resume.pdf", "text/plain", TestData.PDF))
                .andExpect(status().isBadRequest());
        // Correct extension and MIME type but the content is not a PDF (e.g. a renamed executable).
        upload(student.token(), new MockMultipartFile("file", "resume.pdf", "application/pdf", "MZ\u0090\u0000binary".getBytes()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The uploaded file is not a valid PDF document."));
    }

    @Test
    void oversizedResumeIsRejected() throws Exception {
        Account student = data.student(false);
        byte[] big = new byte[5 * 1024 * 1024 + 1];
        System.arraycopy(TestData.PDF, 0, big, 0, TestData.PDF.length);
        upload(student.token(), new MockMultipartFile("file", "big.pdf", "application/pdf", big))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.message").value("The file is too large. The maximum allowed size is 5 MB."));
    }

    @Test
    void adminManagesStudents() throws Exception {
        Account admin = data.admin();
        String email = TestData.uniqueEmail("created");
        Long id = json(postJson("/api/students", admin.token(), Json.of("email", email, "password", "Initial@123",
                "name", "Created Student", "phone", "9876543210", "department", "Civil Engineering", "gpa", 7.5))
                .andExpect(status().isCreated()))
                .path("data").path("id").asLong();

        getJson("/api/students?q=created student&department=Civil Engineering", admin.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").isNumber());
        putJson("/api/students/" + id, admin.token(), Json.of("email", email, "name", "Renamed Student",
                "phone", "9876543210", "department", "Civil Engineering", "gpa", 7.8))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Renamed Student"));

        deleteJson("/api/students/" + id, admin.token()).andExpect(status().isOk());
        getJson("/api/students/" + id, admin.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
        postJson("/api/auth/login", null, Json.of("email", email, "password", "Initial@123"))
                .andExpect(status().isForbidden());
    }
}
