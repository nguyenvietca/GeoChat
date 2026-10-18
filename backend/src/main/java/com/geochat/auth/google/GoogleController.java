package com.geochat.auth.google;

import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.geochat.auth.security.JwtService;
import com.geochat.common.response.ApiResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/v1/auth/google")
public class GoogleController {
	private final GoogleSettings settings;
	private final GoogleFlows flows;
	private final GoogleAccounts accounts;
	private final JwtService jwt;

	public GoogleController(GoogleSettings settings, GoogleFlows flows, GoogleAccounts accounts, JwtService jwt) {
		this.settings = settings;
		this.flows = flows;
		this.accounts = accounts;
		this.jwt = jwt;
	}

	@GetMapping("/config")
	public ApiResponse<Map<String, Boolean>> config(HttpServletResponse response) {
		response.setHeader("Cache-Control", "no-store");
		return ApiResponse.ok(Map.of("enabled", settings.enabled));
	}

	private void origin(HttpServletRequest request) {
		if (!settings.webOrigin.equals(request.getHeader("Origin")))
			throw new org.springframework.security.access.AccessDeniedException("Request origin is not allowed.");
	}

	private String token(HttpServletRequest request) {
		String header = request.getHeader("Authorization");
		return header != null && header.startsWith("Bearer ") ? header.substring(7) : null;
	}

	private void enabled() {
		if (!settings.enabled)
			throw new IllegalArgumentException("Google sign-in is currently unavailable.");
	}

	public record Password(String password) {
	}

	@PostMapping("/start")
	public ApiResponse<Map<String, String>> start(HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		enabled();
		flows.begin(request, response, null, null);
		return ApiResponse.ok(Map.of("url", "/api/oauth2/authorization/google"));
	}

	@PostMapping("/link")
	public ApiResponse<Map<String, String>> link(@RequestBody Password password, Authentication auth,
			HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		enabled();
		var user = accounts.reauthenticate(auth.getName(), password.password());
		flows.begin(request, response, user.getId(), token(request));
		return ApiResponse.ok(Map.of("url", "/api/oauth2/authorization/google"));
	}

	public record Completion(String token, String tokenType, boolean linked) {
	}

	@PostMapping("/complete")
	public ApiResponse<Completion> complete(HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		enabled();
		var flow = flows.redeem(request, response, token(request));
		if (flow.userId != null
				&& (!jwt.isTokenValid(token(request)) || !flow.userId.equals(jwt.getUserId(token(request)))))
			throw new org.springframework.security.authentication.BadCredentialsException(
					"Sign in and connect Google again.");
		var user = accounts.resolve(flow.claims, flow.userId);
		response.setHeader("Cache-Control", "no-store");
		return ApiResponse
				.ok(new Completion(flow.userId == null ? jwt.generateToken(user.getId(), user.getUsername()) : null,
						"Bearer", flow.userId != null));
	}

	@PostMapping("/cancel")
	public ApiResponse<Void> cancel(HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		flows.cancel(request, response);
		return ApiResponse.ok(null);
	}

	@GetMapping("/connections")
	public ApiResponse<GoogleAccounts.Connections> connections(Authentication auth, HttpServletResponse response) {
		response.setHeader("Cache-Control", "no-store");
		return ApiResponse.ok(accounts.connections(auth.getName()));
	}

	@PostMapping("/unlink")
	public ApiResponse<Void> unlink(@RequestBody Password password, Authentication auth, HttpServletRequest request) {
		origin(request);
		accounts.unlink(auth.getName(), password.password());
		return ApiResponse.ok(null);
	}
}
