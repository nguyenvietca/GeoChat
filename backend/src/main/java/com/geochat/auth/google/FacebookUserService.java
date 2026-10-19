package com.geochat.auth.google;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Provider tokens remain transient, and are never returned in application
 * responses.
 */
@Component
public class FacebookUserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {
	private final RestClient client;
	private final DefaultOAuth2UserService profiles = new DefaultOAuth2UserService();

	public FacebookUserService() {
		var factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(Duration.ofSeconds(10));
		factory.setReadTimeout(Duration.ofSeconds(10));
		client = RestClient.builder().requestFactory(factory).build();
	}

	@Override
	@SuppressWarnings("unchecked")
	public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
		try {
			var registration = request.getClientRegistration();
			String profileUri = registration.getProviderDetails().getUserInfoEndpoint().getUri();
			// Derived only from trusted server registration, never browser input.
			String debugUri = profileUri.substring(0, profileUri.lastIndexOf('/')) + "/debug_token";
			Map<String, Object> result = client.get()
					.uri(debugUri + "?input_token={token}", request.getAccessToken().getTokenValue())
					.header("Authorization",
							"Bearer " + registration.getClientId() + "|" + registration.getClientSecret())
					.retrieve().body(Map.class);
			Map<String, Object> data = result == null ? null : (Map<String, Object>) result.get("data");
			validate(data, registration.getClientId());
			OAuth2User user = profiles.loadUser(request);
			if (data != null && !data.get("user_id").equals(user.getName()))
				throw invalid();
			// Validate optional profile metadata before creating the completion artifact.
			new GoogleAccounts.Claims("FACEBOOK", user.getName(), user.getAttribute("email"), false,
					user.getAttribute("name"));
			return user;
		} catch (RuntimeException failure) {
			// Do not propagate HTTP errors containing request URLs or provider secrets.
			throw invalid();
		}
	}

	static void validate(Map<String, Object> data, String appId) {
		long now = Instant.now().getEpochSecond();
		if (data == null || !Boolean.TRUE.equals(data.get("is_valid")) || !appId.equals(data.get("app_id"))
				|| !"USER".equals(data.get("type")) || !(data.get("user_id") instanceof String id) || id.isBlank()
				|| !(data.get("expires_at") instanceof Number expiry) || expiry.longValue() <= now
				|| !(data.get("scopes") instanceof List<?> scopes) || !scopes.contains("public_profile"))
			throw invalid();
		// email is optional, including when the user declined that permission.
		if (data.containsKey("data_access_expires_at")
				&& (!(data.get("data_access_expires_at") instanceof Number dataExpiry)
						|| (dataExpiry.longValue() != 0 && dataExpiry.longValue() <= now)))
			throw invalid();
	}

	private static OAuth2AuthenticationException invalid() {
		return new OAuth2AuthenticationException(new OAuth2Error("invalid_facebook_identity"),
				"Facebook identity could not be verified. Please try again.");
	}
}
