package com.geochat.auth.password;

import com.geochat.common.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/api/v1/auth/password")
public class PasswordResetController {
    private final PasswordResetService resets;
    public PasswordResetController(PasswordResetService resets) { this.resets = resets; }
    public record Request(@NotBlank @Email(message = "Email must be valid") @Size(max = 320) String email) {
        @Override public String toString() { return "PasswordRecoveryRequest[redacted]"; }
    }
    // Validate secrets inside the service so validation exceptions never echo rejected passwords/tokens.
    public record Reset(String token, String password) {
        @Override public String toString() { return "PasswordReset[redacted]"; }
    }
    @GetMapping("/config")
    public ApiResponse<Map<String, Boolean>> config(jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store"); return ApiResponse.ok(Map.of("enabled", resets.available()));
    }
    @PostMapping("/forgot")
    public ApiResponse<Void> request(@Valid @RequestBody Request proof, jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store"); resets.request(proof.email()); return ApiResponse.ok(null);
    }
    @PostMapping("/reset")
    public ApiResponse<Void> reset(@RequestBody Reset proof, jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store"); resets.reset(proof.token(), proof.password()); return ApiResponse.ok(null);
    }
}
