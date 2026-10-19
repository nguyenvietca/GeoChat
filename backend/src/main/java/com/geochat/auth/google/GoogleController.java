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
@RequestMapping({ "/api/v1/auth/google", "/api/v1/auth/facebook" })
public class GoogleController {
	private final GoogleSettings settings;
	private final FacebookSettings facebook;

	private String provider(HttpServletRequest request) {
		return request.getRequestURI().startsWith("/api/v1/auth/facebook/") ? "facebook" : "google";
	}

	private final GoogleFlows flows;
	private final GoogleAccounts accounts;
	private final JwtService jwt;
	private final com.geochat.user.service.AccountLifecycleService lifecycle;

	public GoogleController(GoogleSettings settings, FacebookSettings facebook, GoogleFlows flows,
			GoogleAccounts accounts, JwtService jwt, com.geochat.user.service.AccountLifecycleService lifecycle) {
		this.settings = settings;
		this.facebook = facebook;
		this.flows = flows;
		this.accounts = accounts;
		this.jwt = jwt;
		this.lifecycle = lifecycle;
	}

	@GetMapping("/config")
	public ApiResponse<Map<String, Boolean>> config(HttpServletRequest request, HttpServletResponse response) {
		response.setHeader("Cache-Control", "no-store");
		return ApiResponse
				.ok(Map.of("enabled", "facebook".equals(provider(request)) ? facebook.enabled : settings.enabled));
	}

	private void origin(HttpServletRequest request) {
		if (!settings.webOrigin.equals(request.getHeader("Origin")))
			throw new org.springframework.security.access.AccessDeniedException("Request origin is not allowed.");
	}

	private String token(HttpServletRequest request) {
		String header = request.getHeader("Authorization");
		return header != null && header.startsWith("Bearer ") ? header.substring(7) : null;
	}

	private void enabled(HttpServletRequest request) {
		enabled(provider(request));
	}

	private void enabled(String provider) {
		if (!("facebook".equals(provider) ? facebook.enabled : settings.enabled))
			throw new IllegalArgumentException("Provider sign-in is currently unavailable.");
	}

	public record Password(String password) {
	}

	@PostMapping("/start")
	public ApiResponse<Map<String, String>> start(HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		enabled(request);
		flows.beginProvider(request, response, null, null, "LOGIN", provider(request));
		return ApiResponse.ok(Map.of("url", "/api/oauth2/authorization/" + provider(request)));
	}

	@PostMapping("/link")
	public ApiResponse<Map<String, String>> link(@RequestBody Password password, Authentication auth,
			HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		enabled(request);
		var user = accounts.reauthenticate(auth.getName(), password.password());
		flows.beginProvider(request, response, user.getId(), token(request), "LINK", provider(request));
		return ApiResponse.ok(Map.of("url", "/api/oauth2/authorization/" + provider(request)));
	}

	public record Reauthentication(String action) {
	}

	@PostMapping("/reauth")
	public ApiResponse<Map<String, String>> reauthenticate(@RequestBody Reauthentication body, Authentication auth,
			HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		enabled(request);
		String target = "google".equals(provider(request)) ? "facebook" : "google";
		String action = body.action();
		if (!("link".equals(action) || "unlink".equals(action)))
			throw new IllegalArgumentException("Unsupported account action.");
		if ("link".equals(action))
			enabled(target);
		var user = accounts.active(jwt.getUserId(token(request)));
		flows.beginProvider(request, response, user.getId(), token(request),
				action.toUpperCase(java.util.Locale.ROOT) + ":" + target, provider(request));
		return ApiResponse.ok(Map.of("url", "/api/oauth2/authorization/" + provider(request)));
	}

	@PostMapping("/deactivate")
	public ApiResponse<Map<String, String>> deactivate(Authentication auth, HttpServletRequest request,
			HttpServletResponse response) {
		origin(request);
		enabled(request);
		var user = accounts.active(jwt.getUserId(token(request)));
		flows.beginProvider(request, response, user.getId(), token(request), "DEACTIVATE", provider(request));
		return ApiResponse.ok(Map.of("url", "/api/oauth2/authorization/" + provider(request)));
	}

	public record Completion(String token, String tokenType, boolean linked, boolean deactivated, String nextUrl) {
	}

	@PostMapping("/complete")
	public ApiResponse<Completion> complete(HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		enabled(request);
		var flow = flows.redeem(request, response, token(request));
		if (!flow.provider.equals(provider(request)))
			throw new IllegalArgumentException("Provider mismatch.");
		if (flow.userId != null
				&& (!jwt.isTokenValid(token(request)) || !flow.userId.equals(jwt.getUserId(token(request)))))
			throw new org.springframework.security.authentication.BadCredentialsException(
					"Sign in and connect Google again.");
		if (flow.userId != null) {
			var current = accounts.active(flow.userId);
			if (current.getAuthVersion() != jwt.getAuthVersion(token(request)))
				throw new org.springframework.security.access.AccessDeniedException("Sign in again.");
		}
		if (flow.purpose.startsWith("LINK:") || flow.purpose.startsWith("UNLINK:")) {
			var proof = accounts.existingIdentity(flow.claims);
			if (!proof.getId().equals(flow.userId))
				throw new org.springframework.security.access.AccessDeniedException(
						"Use an identity already connected to your account.");
			String target = flow.purpose.split(":", 2)[1];
			if (flow.purpose.startsWith("UNLINK:")) {
				accounts.unlinkVerified(flow.userId, target.toUpperCase(java.util.Locale.ROOT),
						jwt.getAuthVersion(token(request)));
				return ApiResponse.ok(new Completion(null, "Bearer", true, false, null));
			}
			enabled(target);
			flows.beginProvider(request, response, flow.userId, token(request), "LINK", target);
			return ApiResponse.ok(new Completion(null, "Bearer", false, false, "/api/oauth2/authorization/" + target));
		}
		if ("DEACTIVATE".equals(flow.purpose)) {
			var user = accounts.existingIdentity(flow.claims);
			if (!user.getId().equals(flow.userId))
				throw new org.springframework.security.access.AccessDeniedException(
						"Use the Google account connected to this account.");
			lifecycle.deactivateGoogle(user.getId(), jwt.getAuthVersion(token(request)));
			return ApiResponse.ok(new Completion(null, "Bearer", false, true, null));
		}
		var user = accounts.resolve(flow.claims, flow.userId,
				flow.userId == null ? null : jwt.getAuthVersion(token(request)));
		response.setHeader("Cache-Control", "no-store");
		return ApiResponse.ok(new Completion(
				flow.userId == null ? jwt.generateToken(user.getId(), user.getUsername(), user.getAuthVersion()) : null,
				"Bearer", flow.userId != null, false, null));
	}

	@PostMapping("/cancel")
	public ApiResponse<Void> cancel(HttpServletRequest request, HttpServletResponse response) {
		origin(request);
		flows.cancel(request, response);
		return ApiResponse.ok(null);
	}

	@GetMapping("/connections")
	public ApiResponse<GoogleAccounts.Connections> connections(Authentication auth, HttpServletRequest request,
			HttpServletResponse response) {
		response.setHeader("Cache-Control", "no-store");
		return ApiResponse
				.ok(accounts.connections(auth.getName(), provider(request).toUpperCase(java.util.Locale.ROOT)));
	}

	@PostMapping("/unlink")
	public ApiResponse<Void> unlink(@RequestBody Password password, Authentication auth, HttpServletRequest request) {
		origin(request);
		accounts.unlink(auth.getName(), password.password(), provider(request).toUpperCase(java.util.Locale.ROOT));
		return ApiResponse.ok(null);
	}
}
