package com.cims.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.auth.AuthResponse;
import com.cims.dto.auth.ChangePasswordRequest;
import com.cims.dto.auth.CurrentUserDto;
import com.cims.dto.auth.LoginRequest;
import com.cims.dto.auth.RegisterRequest;
import com.cims.dto.auth.VerifyEmailRequest;
import com.cims.dto.common.ApiResponse;
import com.cims.service.AuthService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** Student self-registration. */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Registration successful. Please check your e-mail to verify your address.",
                        authService.register(request)));
    }

    /** Login for every role. */
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok("Login successful.", authService.login(request));
    }

    /** JWTs are stateless: the client discards its token; the server records the logout. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        authService.logout();
        return ApiResponse.message("You have been logged out.");
    }

    @GetMapping("/me")
    public ApiResponse<CurrentUserDto> me() {
        return ApiResponse.ok(authService.me());
    }

    @PostMapping("/verify-email")
    public ApiResponse<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request.token());
        return ApiResponse.message("Your e-mail address has been verified.");
    }

    @PostMapping("/resend-verification")
    public ApiResponse<Void> resendVerification() {
        authService.resendVerification();
        return ApiResponse.message("A new verification link has been sent to your e-mail address.");
    }

    @PutMapping("/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return ApiResponse.message("Your password has been changed.");
    }
}
