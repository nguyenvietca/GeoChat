package com.geochat.user.controller;

import com.geochat.auth.dto.*;
import com.geochat.auth.security.JwtService;
import com.geochat.common.response.ApiResponse;
import com.geochat.common.security.*;
import com.geochat.user.service.AccountLifecycleService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.*;

@RestController
public class AccountLifecycleController {
    private final AccountLifecycleService accounts;
    private final JwtService jwt;
    private final LoginAttemptGuard attempts;
    private final ClientAddress addresses;

    public AccountLifecycleController(AccountLifecycleService accounts, JwtService jwt,
                                      LoginAttemptGuard attempts, ClientAddress addresses) {
        this.accounts = accounts; this.jwt = jwt; this.attempts = attempts; this.addresses = addresses;
    }
    public record Password(@Size(max = 128) String password) {}

    @PostMapping("/api/v1/users/me/deactivate")
    public ApiResponse<Void> deactivate(Authentication auth, @Valid @RequestBody Password proof, HttpServletRequest request) {
        attempts.check(auth.getName(), addresses.resolve(request));
        accounts.deactivate(auth.getName(), proof.password());
        return ApiResponse.ok(null);
    }

    @PostMapping("/api/v1/users/me/reactivate")
    public ApiResponse<AuthResponse> reactivate(Authentication auth,
                                               HttpServletRequest request, HttpServletResponse response) {
        var principal = (com.geochat.auth.security.AccountPrincipal) auth.getPrincipal();
        var user = accounts.reactivateSession(principal.account().getId(), principal.account().getAuthVersion());
        response.setHeader("Cache-Control", "no-store");
        return ApiResponse.ok(new AuthResponse(jwt.generateToken(user.getId(), user.getUsername(), user.getAuthVersion()), "Bearer"));
    }
}
