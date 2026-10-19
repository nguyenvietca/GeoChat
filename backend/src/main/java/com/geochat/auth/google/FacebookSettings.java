package com.geochat.auth.google;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.stereotype.Component;

@Component
public class FacebookSettings {
	public final boolean enabled;
	public final String appId, secret, redirectUri, version;

	public FacebookSettings(@Value("${facebook.enabled:false}") boolean enabled,
			@Value("${facebook.app-id:}") String appId, @Value("${facebook.app-secret:}") String secret,
			@Value("${facebook.redirect-uri:http://localhost:8081/api/login/oauth2/code/facebook}") String redirectUri,
			@Value("${facebook.graph-version:v25.0}") String version, GoogleSettings shared) {
		this.enabled = enabled;
		this.appId = appId;
		this.secret = secret;
		this.redirectUri = redirectUri;
		this.version = version;
		if (enabled) {
			if (!appId.matches("[0-9]{5,64}") || !secret.matches("[a-fA-F0-9]{32}")
					|| !version.matches("v[0-9]{2}\\.0"))
				throw new IllegalStateException(
						"Enabled Facebook login requires server-side App ID, App Secret and Graph version.");
			URI callback = GoogleSettings.validUrl(redirectUri);
			URI web = GoogleSettings.validUrl(shared.webOrigin);
			if (!"/api/login/oauth2/code/facebook".equals(callback.getPath())
					|| (web.getPath() != null && !web.getPath().isEmpty())
					|| (!callback.resolve("/").equals(web.resolve("/"))
							&& !(GoogleSettings.loopback(callback) && GoogleSettings.loopback(web))))
				throw new IllegalStateException("Facebook callback must use the documented exact path.");
		}
	}

	ClientRegistration registration() {
		return ClientRegistration.withRegistrationId("facebook").clientId(appId).clientSecret(secret)
				.clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
				.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).redirectUri(redirectUri)
				.scope("public_profile", "email")
				.authorizationUri("https://www.facebook.com/" + version + "/dialog/oauth")
				.tokenUri("https://graph.facebook.com/" + version + "/oauth/access_token")
				.userInfoUri("https://graph.facebook.com/" + version + "/me?fields=id,name,email")
				.userNameAttributeName("id").clientName("Facebook").build();
	}
}
