package com.cims.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cims.dto.auth.CurrentUserDto;
import com.cims.dto.common.ApiResponse;
import com.cims.service.UserAccountService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/** Account administration shared by students and faculty (admin only). */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserAccountService userAccountService;

    public UserController(UserAccountService userAccountService) {
        this.userAccountService = userAccountService;
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<CurrentUserDto> setStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        CurrentUserDto user = userAccountService.setActive(id, request.active());
        return ApiResponse.ok(request.active() ? "Account activated." : "Account deactivated.", user);
    }

    @PatchMapping("/{id}/verify")
    public ApiResponse<CurrentUserDto> verify(@PathVariable Long id) {
        return ApiResponse.ok("E-mail marked as verified.", userAccountService.markVerified(id));
    }

    public record StatusRequest(@NotNull(message = "active is required.") Boolean active) {
    }
}
