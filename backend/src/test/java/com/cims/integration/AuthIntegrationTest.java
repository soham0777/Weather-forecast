package com.cims.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.cims.service.EmailService;
import com.cims.support.IntegrationTestBase;
import com.cims.support.Json;
import com.cims.support.TestData;
import com.cims.support.TestData.Account;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

class AuthIntegrationTest extends IntegrationTestBase {

    @MockitoBean
    EmailService emailService;

    private static java.util.Map<String, Object> registration(String email, String password) {
        return Json.of("email", email, "password", password, "name", "Bhakti Kulkarni", "phone", "9876543210",
                "department", "Computer Engineering", "gpa", 8.75);
    }

    @Test
    void registerCreatesUnverifiedStudentAndReturnsToken() throws Exception {
        String email = TestData.uniqueEmail("Bhakti.K").toUpperCase();
        postJson("/api/auth/register", null, registration(email, "Bhakti@123"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(jsonPath("$.data.user.role").value("STUDENT"))
                .andExpect(jsonPath("$.data.user.email").value(email.toLowerCase()))
                .andExpect(jsonPath("$.data.user.verified").value(false));
    }

    @Test
    void registerRejectsWeakPassword() throws Exception {
        for (String weak : new String[] {"bhakti@123", "BHAKTI@123", "Bhakti@abc", "Bhakti123", "Bh@1"}) {
            postJson("/api/auth/register", null, registration(TestData.uniqueEmail("weak"), weak))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.errors.password").exists());
        }
    }

    @Test
    void registerRejectsInvalidEmail() throws Exception {
        for (String bad : new String[] {"plainaddress", "user@", "user@domain", "@domain.com"}) {
            postJson("/api/auth/register", null, registration(bad, "Bhakti@123"))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.errors.email").exists());
        }
    }

    @Test
    void registerRejectsDuplicateEmailCaseInsensitively() throws Exception {
        String email = TestData.uniqueEmail("dup");
        postJson("/api/auth/register", null, registration(email, "Bhakti@123")).andExpect(status().isCreated());
        postJson("/api/auth/register", null, registration("  " + email.toUpperCase() + " ", "Bhakti@123"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("An account with this e-mail address already exists."));
    }

    @Test
    void loginSucceedsAndRejectsWrongPassword() throws Exception {
        Account student = data.student(false);
        postJson("/api/auth/login", null, Json.of("email", student.user().getEmail(), "password", TestData.PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(jsonPath("$.data.user.role").value("STUDENT"));
        postJson("/api/auth/login", null, Json.of("email", student.user().getEmail(), "password", "Wrong@1234"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid e-mail or password."));
        postJson("/api/auth/login", null, Json.of("email", "nobody@test.cims.test", "password", "Wrong@1234"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deactivatedAccountCannotLoginOrUseExistingToken() throws Exception {
        Account admin = data.admin();
        Account student = data.student(false);
        getJson("/api/auth/me", student.token()).andExpect(status().isOk());

        patchJson("/api/users/" + student.user().getId() + "/status", admin.token(), Json.of("active", false))
                .andExpect(status().isOk());

        postJson("/api/auth/login", null, Json.of("email", student.user().getEmail(), "password", TestData.PASSWORD))
                .andExpect(status().isForbidden());
        getJson("/api/auth/me", student.token())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Your account has been deactivated. Please contact the administrator."));
    }

    @Test
    void protectedEndpointsRequireValidToken() throws Exception {
        getJson("/api/auth/me", null).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
        getJson("/api/auth/me", "not-a-jwt").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid authentication token. Please log in again."));

        // Token signed with a different key
        String forged = Jwts.builder().subject("1").issuer("cims")
                .signWith(Keys.hmacShaKeyFor("another-secret-another-secret-another-secret!!".getBytes(StandardCharsets.UTF_8)))
                .compact();
        getJson("/api/auth/me", forged).andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        Account student = data.student(false);
        String expired = Jwts.builder().subject(String.valueOf(student.user().getId())).issuer("cims")
                .issuedAt(new Date(System.currentTimeMillis() - 7_200_000))
                .expiration(new Date(System.currentTimeMillis() - 3_600_000))
                .signWith(Keys.hmacShaKeyFor("test-only-jwt-secret-value-0123456789-abcdefghij".getBytes(StandardCharsets.UTF_8)))
                .compact();
        getJson("/api/auth/me", expired)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Your session has expired. Please log in again."));
    }

    @Test
    void roleBasedAccessIsEnforced() throws Exception {
        Account student = data.student(false);
        Account faculty = data.faculty();
        getJson("/api/students", student.token()).andExpect(status().isForbidden());
        getJson("/api/reports/admin", student.token()).andExpect(status().isForbidden());
        getJson("/api/dashboard/admin", faculty.token()).andExpect(status().isForbidden());
        getJson("/api/reports/faculty", student.token()).andExpect(status().isForbidden());
        postJson("/api/companies", faculty.token(), Json.of("name", "X")).andExpect(status().isForbidden());
        getJson("/api/audit-logs", faculty.token()).andExpect(status().isForbidden());
    }

    @Test
    void emailVerificationFlow() throws Exception {
        String email = TestData.uniqueEmail("verify");
        String token = json(postJson("/api/auth/register", null, registration(email, "Bhakti@123")))
                .path("data").path("token").asText();

        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendVerificationEmail(eq(email), anyString(), link.capture());
        String rawToken = link.getValue().substring(link.getValue().indexOf("token=") + 6);

        postJson("/api/auth/verify-email", null, Json.of("token", "invalid-token")).andExpect(status().isBadRequest());
        postJson("/api/auth/verify-email", null, Json.of("token", rawToken)).andExpect(status().isOk());
        getJson("/api/auth/me", token).andExpect(jsonPath("$.data.verified").value(true));
        postJson("/api/auth/resend-verification", token, Json.of()).andExpect(status().isConflict());
    }

    @Test
    void changePassword() throws Exception {
        Account student = data.student(false);
        putJson("/api/auth/change-password", student.token(),
                Json.of("currentPassword", "Wrong@1234", "newPassword", "Newpass@123"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.currentPassword").exists());
        putJson("/api/auth/change-password", student.token(),
                Json.of("currentPassword", TestData.PASSWORD, "newPassword", "Newpass@123"))
                .andExpect(status().isOk());
        postJson("/api/auth/login", null, Json.of("email", student.user().getEmail(), "password", "Newpass@123"))
                .andExpect(status().isOk());
        assertThat(student.user().getEmail()).isNotBlank();
    }
}
