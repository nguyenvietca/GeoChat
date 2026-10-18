package com.geochat.auth.google;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Short-lived browser-bound protocol state only; no permanent application
 * session.
 */
@Component
public class GoogleFlows implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {
	static final String COOKIE = "geochat_google_flow";
	static final String CALLBACK_FLOW = GoogleFlows.class.getName();
	private final Map<String, Flow> flows = new HashMap<>();
	private final GoogleSettings settings;
	private final Clock clock;

	@org.springframework.beans.factory.annotation.Autowired
	public GoogleFlows(GoogleSettings settings) {
		this(settings, Clock.systemUTC());
	}

	GoogleFlows(GoogleSettings settings, Clock clock) {
		this.settings = settings;
		this.clock = clock;
	}

	static final class Flow {
		final Long userId;
		final String sessionHash;
		Instant expires;
		OAuth2AuthorizationRequest request;
		boolean started;
		GoogleAccounts.Claims claims;

		Flow(Long userId, String sessionHash, Instant expires) {
			this.userId = userId;
			this.sessionHash = sessionHash;
			this.expires = expires;
		}
	}

	public static String fingerprint(String token) {
		try {
			return HexFormat.of()
					.formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

	private static String random() {
		byte[] bytes = new byte[32];
		new SecureRandom().nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private String cookie(HttpServletRequest request) {
		if (request.getCookies() != null)
			for (Cookie c : request.getCookies())
				if (cookieName().equals(c.getName()))
					return c.getValue();
		return "";
	}

	private String cookieName() {
		return settings.secureCookie() ? "__Host-" + COOKIE : COOKIE;
	}

	private void setCookie(HttpServletResponse response, String value, int seconds) {
		response.addHeader("Set-Cookie",
				ResponseCookie.from(cookieName(), value).httpOnly(true).secure(settings.secureCookie()).sameSite("Lax")
						.path(settings.secureCookie() ? "/" : "/api").maxAge(seconds).build().toString());
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("Referrer-Policy", "no-referrer");
	}

	private void prune() {
		flows.values().removeIf(f -> !clock.instant().isBefore(f.expires));
	}

	public synchronized void begin(HttpServletRequest request, HttpServletResponse response, Long userId,
			String token) {
		prune();
		flows.remove(cookie(request));
		if (flows.size() >= 1000)
			throw new IllegalArgumentException("Google login is busy. Please try again.");
		String key = random();
		flows.put(key, new Flow(userId, userId == null ? null : fingerprint(token), clock.instant().plusSeconds(300)));
		setCookie(response, key, 300);
	}

	private Flow current(HttpServletRequest request) {
		prune();
		return flows.get(cookie(request));
	}

	@Override
	public synchronized OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
		Flow flow = current(request);
		return flow == null ? null : flow.request;
	}

	@Override
	public synchronized void saveAuthorizationRequest(OAuth2AuthorizationRequest auth, HttpServletRequest request,
			HttpServletResponse response) {
		Flow flow = current(request);
		if (auth == null) {
			cancel(request, response);
			return;
		}
		if (flow == null || flow.started)
			throw new org.springframework.security.oauth2.core.OAuth2AuthenticationException("invalid_state");
		flow.started = true;
		flow.request = auth;
	}

	@Override
	public synchronized OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
			HttpServletResponse response) {
		Flow flow = current(request);
		if (flow == null || flow.request == null
				|| !Objects.equals(flow.request.getState(), request.getParameter("state")))
			return null;
		var saved = flow.request;
		flow.request = null;
		request.setAttribute(CALLBACK_FLOW, flow);
		return saved;
	}

	public synchronized void complete(HttpServletRequest request, HttpServletResponse response,
			GoogleAccounts.Claims claims) {
		Flow flow = (Flow) request.getAttribute(CALLBACK_FLOW);
		if (flow == null || flows.get(cookie(request)) != flow || !clock.instant().isBefore(flow.expires))
			throw new IllegalArgumentException("Google sign-in expired.");
		flows.remove(cookie(request));
		String ticket = random();
		flow.claims = claims;
		flow.expires = clock.instant().plusSeconds(30);
		flows.put(ticket, flow);
		setCookie(response, ticket, 30);
	}

	public synchronized Flow redeem(HttpServletRequest request, HttpServletResponse response, String token) {
		Flow flow = current(request);
		if (flow == null || flow.claims == null)
			throw new IllegalArgumentException("Google sign-in expired. Please start again.");
		// Consume even a failed attempt, so a wrong session cannot keep probing a
		// ticket.
		flows.remove(cookie(request));
		setCookie(response, "", 0);
		if (flow.userId != null && (token == null || !fingerprint(token).equals(flow.sessionHash)))
			throw new org.springframework.security.authentication.BadCredentialsException(
					"Your session changed. Sign in and connect Google again.");
		return flow;
	}

	public synchronized void cancel(HttpServletRequest request, HttpServletResponse response) {
		flows.remove(cookie(request));
		setCookie(response, "", 0);
	}
}
