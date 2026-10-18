package com.geochat.auth.google;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class GoogleSettings {
	public final boolean enabled;
	public final String clientId, clientSecret, redirectUri, webOrigin;

	public GoogleSettings(@Value("${google.enabled:false}") boolean enabled,
			@Value("${google.client-id:}") String clientId, @Value("${google.client-secret:}") String secret,
			@Value("${google.redirect-uri:http://localhost:8081/api/login/oauth2/code/google}") String redirect,
			@Value("${google.web-origin:http://localhost:8081}") String origin) {
		this.enabled = enabled;
		this.clientId = clientId;
		this.clientSecret = secret;
		this.redirectUri = redirect;
		this.webOrigin = origin;
		if (enabled) {
			if (!clientId.endsWith(".apps.googleusercontent.com") || clientId.startsWith("replace") || secret.isBlank()
					|| secret.length() < 12 || placeholder(clientId) || placeholder(secret))
				throw new IllegalStateException("Enabled Google login requires valid server-side client credentials.");
			URI callback = validUrl(redirect);
			URI web = validUrl(origin);
			if (!"/api/login/oauth2/code/google".equals(callback.getPath())
					|| (web.getPath() != null && !web.getPath().isEmpty()))
				throw new IllegalStateException("Google callback/origin must use the documented exact paths.");
			if (!callback.resolve("/").equals(web.resolve("/")) && !(loopback(callback) && loopback(web)))
				throw new IllegalStateException("Google callback must use the Web origin.");
		}
	}

	private static URI validUrl(String value) {
		try {
			URI uri = URI.create(value);
			if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
					|| uri.getFragment() != null
					|| !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && loopback(uri))))
				throw new IllegalArgumentException();
			return uri;
		} catch (RuntimeException e) {
			throw new IllegalStateException("Google URLs require HTTPS (HTTP only on localhost).");
		}
	}

	private static boolean loopback(URI uri) {
		return "localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost());
	}

	private static boolean placeholder(String value) {
		String text = value.toLowerCase(java.util.Locale.ROOT);
		return text.contains("replace") || text.contains("placeholder") || text.startsWith("your-")
				|| text.contains("change-me") || text.contains("example") || text.contains("<");
	}

	public boolean secureCookie() {
		return redirectUri.startsWith("https://");
	}
}
