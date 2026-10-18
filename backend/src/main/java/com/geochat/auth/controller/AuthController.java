package com.geochat.auth.controller;

import com.geochat.auth.dto.AuthResponse;
import com.geochat.auth.dto.LoginRequest;
import com.geochat.auth.service.AuthService;
import com.geochat.common.response.ApiResponse;
import com.geochat.user.dto.RegisterRequest;
import com.geochat.user.dto.UserResponse;
import com.geochat.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

	private final AuthService authService;
	private final UserService userService;
	private final com.geochat.common.security.ClientAddress addresses;
	private final com.geochat.common.security.LoginAttemptGuard attempts;
	private final com.geochat.auth.service.RegistrationBotCheck botCheck;

	public AuthController(AuthService authService, UserService userService,
			com.geochat.common.security.ClientAddress addresses,
			com.geochat.common.security.LoginAttemptGuard attempts,
			com.geochat.auth.service.RegistrationBotCheck botCheck) {
		this.addresses = addresses;
		this.attempts = attempts;
		this.botCheck = botCheck;
		this.authService = authService;
		this.userService = userService;
	}

	@PostMapping("/register")
	public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request, jakarta.servlet.http.HttpServletRequest http) {
		botCheck.verify(request.botToken(), addresses.resolve(http));
		return ApiResponse.ok(userService.register(request));
	}

	@org.springframework.web.bind.annotation.GetMapping("/registration-config")
	public ApiResponse<com.geochat.auth.service.RegistrationBotCheck.Config> registrationConfig(HttpServletResponse response) {
		response.setHeader("Cache-Control", "no-store");
		return ApiResponse.ok(botCheck.config());
	}

	@PostMapping("/login")
	public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response,
			jakarta.servlet.http.HttpServletRequest http) {
		attempts.check(request.username(), addresses.resolve(http));
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("Pragma", "no-cache");
		return ApiResponse.ok(authService.login(request));
	}
}
