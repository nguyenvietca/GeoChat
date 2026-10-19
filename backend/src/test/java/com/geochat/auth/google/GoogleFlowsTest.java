package com.geochat.auth.google;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import jakarta.servlet.http.Cookie;

class GoogleFlowsTest {
	static final class Time extends Clock {
		Instant now = Instant.parse("2026-01-01T00:00:00Z");

		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		public Clock withZone(ZoneId zone) {
			return this;
		}

		public Instant instant() {
			return now;
		}
	}

	GoogleSettings settings = new GoogleSettings(false, "", "", "http://localhost:8081/api/login/oauth2/code/google",
			"http://localhost:8081");

	@Test
	void authorizationAndCompletionExpireAndConsumeOnce() {
		Time time = new Time();
		GoogleFlows flows = new GoogleFlows(settings, time);
		var request = new MockHttpServletRequest();
		var response = new MockHttpServletResponse();
		flows.begin(request, response, null, null);
		request.setCookies(cookie(response));
		var authorization = OAuth2AuthorizationRequest.authorizationCode()
				.authorizationUri("https://accounts.google.com/auth").clientId("client")
				.redirectUri(settings.redirectUri).state("state").attributes(a -> a.put("registration_id", "google")).build();
		flows.saveAuthorizationRequest(authorization, request, response);
		request.setParameter("state", "state");
		assertThat(flows.removeAuthorizationRequest(request, response)).isNotNull();
		assertThat(flows.removeAuthorizationRequest(request, response)).isNull();
		flows.complete(request, response, new GoogleAccounts.Claims("subject", "test@example.com", true, "Test"));
		request.setCookies(cookie(response));
		time.now = time.now.plusSeconds(31);
		assertThatThrownBy(() -> flows.redeem(request, new MockHttpServletResponse(), null))
				.isInstanceOf(IllegalArgumentException.class);
		response = new MockHttpServletResponse();
		flows.begin(request, response, null, null);
		request.setCookies(cookie(response));
		flows.saveAuthorizationRequest(authorization, request, response);
		time.now = time.now.plusSeconds(301);
		assertThat(flows.removeAuthorizationRequest(request, response)).isNull();
	}

	Cookie cookie(MockHttpServletResponse response) {
		var headers = response.getHeaders("Set-Cookie").toArray(String[]::new);
		return new Cookie(GoogleFlows.COOKIE, headers[headers.length - 1].split(";", 2)[0].split("=", 2)[1]);
	}

	@Test
	void optionalConfigurationAndUnsafeUrls() {
		assertThat(settings.enabled).isFalse();
		assertThatThrownBy(() -> new GoogleSettings(true, "", "", "http://localhost/callback", "http://localhost"))
				.isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> new GoogleSettings(true, "test.apps.googleusercontent.com", "synthetic-secret",
				"http://public.example/api/login/oauth2/code/google", "http://public.example"))
				.isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> new GoogleAccounts.Claims("subject", "a@example.com", false, "name"))
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void cancelledInFlightCallbackCannotResurrectItsTransaction() {
		GoogleFlows flows = new GoogleFlows(settings, new Time());
		var request = new MockHttpServletRequest();
		var response = new MockHttpServletResponse();
		flows.begin(request, response, null, null);
		request.setCookies(cookie(response));
		flows.saveAuthorizationRequest(
				OAuth2AuthorizationRequest.authorizationCode().authorizationUri("https://accounts.google.com/auth")
						.clientId("client").redirectUri(settings.redirectUri).state("state").attributes(a -> a.put("registration_id", "google")).build(),
				request, response);
		request.setParameter("state", "state");
		flows.removeAuthorizationRequest(request, response);
		flows.cancel(request, new MockHttpServletResponse());
		assertThatThrownBy(() -> flows.complete(request, new MockHttpServletResponse(),
				new GoogleAccounts.Claims("subject", "test@example.com", true, "Test")))
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void httpsCookiesPreventSiblingDomainCookieTossing() {
		var secure = new GoogleSettings(true, "test.apps.googleusercontent.com", "synthetic-secret-only",
				"https://app.geochat.invalid/api/login/oauth2/code/google", "https://app.geochat.invalid");
		var response = new MockHttpServletResponse();
		new GoogleFlows(secure).begin(new MockHttpServletRequest(), response, null, null);
		assertThat(response.getHeader("Set-Cookie")).startsWith("__Host-geochat_google_flow=")
				.contains("Secure", "HttpOnly", "Path=/;", "SameSite=Lax").doesNotContain("Domain=");
	}
}
