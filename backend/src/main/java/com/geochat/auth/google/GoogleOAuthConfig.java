package com.geochat.auth.google;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.security.web.savedrequest.NullRequestCache;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
@org.springframework.boot.autoconfigure.condition.ConditionalOnExpression("${google.enabled:false} or ${facebook.enabled:false}")
public class GoogleOAuthConfig {
	@Bean
	ClientRegistrationRepository googleRegistrations(GoogleSettings settings, FacebookSettings facebook) {
		// Explicit endpoints avoid discovery/network during optional startup and CI.
		var registrations = new java.util.ArrayList<ClientRegistration>();
		if (settings.enabled) {
			var registration = ClientRegistration.withRegistrationId("google").clientId(settings.clientId)
					.clientSecret(settings.clientSecret)
					.clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
					.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).redirectUri(settings.redirectUri)
					.scope("openid", "email", "profile")
					.authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
					.tokenUri("https://oauth2.googleapis.com/token")
					.jwkSetUri("https://www.googleapis.com/oauth2/v3/certs").issuerUri("https://accounts.google.com")
					.userInfoUri("https://openidconnect.googleapis.com/v1/userinfo").userNameAttributeName("sub")
					.clientName("Google").build();
			registrations.add(registration);
		}
		if (facebook.enabled)
			registrations.add(facebook.registration());
		return new InMemoryClientRegistrationRepository(registrations);
	}

	@Bean
	@Order(1)
	SecurityFilterChain googleSecurity(HttpSecurity http, ClientRegistrationRepository registrations, GoogleFlows flows,
			GoogleSettings settings, FacebookUserService facebookUsers) throws Exception {
		var resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/api/oauth2/authorization");
		resolver.setAuthorizationRequestCustomizer(builder -> builder.attributes(attributes -> {
			if ("google".equals(attributes.get("registration_id")))
				OAuth2AuthorizationRequestCustomizers.withPkce().accept(builder);
			else {
				// Spring 7.1 also applies PKCE by default to confidential clients.
				// Facebook's selected manual flow has no verified PKCE support.
				attributes.remove("code_verifier");
				builder.additionalParameters(parameters -> {
					parameters.remove("code_challenge");
					parameters.remove("code_challenge_method");
				});
			}
		}));
		// No authorized-client/token persistence, even after successful OIDC
		// authentication.
		OAuth2AuthorizedClientRepository noTokens = new OAuth2AuthorizedClientRepository() {
			public <T extends org.springframework.security.oauth2.client.OAuth2AuthorizedClient> T loadAuthorizedClient(
					String id, org.springframework.security.core.Authentication p, HttpServletRequest r) {
				return null;
			}

			public void saveAuthorizedClient(org.springframework.security.oauth2.client.OAuth2AuthorizedClient c,
					org.springframework.security.core.Authentication p, HttpServletRequest r, HttpServletResponse s) {
			}

			public void removeAuthorizedClient(String id, org.springframework.security.core.Authentication p,
					HttpServletRequest r, HttpServletResponse s) {
			}
		};
		http.securityMatcher("/api/oauth2/**", "/api/login/oauth2/**")
				.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.securityContext(s -> s.securityContextRepository(new NullSecurityContextRepository()))
				.requestCache(c -> c.requestCache(new NullRequestCache()))
				.authorizeHttpRequests(a -> a.anyRequest().permitAll()).oauth2Login(
						o -> o.authorizedClientRepository(noTokens).userInfoEndpoint(u -> u.userService(facebookUsers))
								.authorizationEndpoint(a -> a.baseUri("/api/oauth2/authorization")
										.authorizationRequestResolver(resolver).authorizationRequestRepository(flows))
								.redirectionEndpoint(r -> r.baseUri("/api/login/oauth2/code/*"))
								.successHandler((request, response, authentication) -> {
									try {
										var oauth = (OAuth2AuthenticationToken) authentication;
										var principal = oauth.getPrincipal();
										if ("facebook".equals(oauth.getAuthorizedClientRegistrationId())) {
											flows.complete(request, response,
													new GoogleAccounts.Claims("FACEBOOK", principal.getName(),
															principal.getAttribute("email"), false,
															principal.getAttribute("name")));
										} else {
											OidcUser user = (OidcUser) principal;
											// Claims come only from Spring's validated OIDC authentication provider.
											flows.complete(request, response,
													new GoogleAccounts.Claims(user.getSubject(), user.getEmail(),
															Boolean.TRUE.equals(user.getEmailVerified()),
															user.getFullName()));
										}
										response.sendRedirect(settings.webOrigin + "/oauth/complete"
												+ ("facebook".equals(oauth.getAuthorizedClientRegistrationId())
														? "?provider=facebook"
														: ""));
									} catch (RuntimeException failure) {
										flows.cancel(request, response);
										response.sendRedirect(settings.webOrigin + "/oauth/complete?error=failed");
									}
								}).failureHandler((request, response, failure) -> {
									flows.cancel(request, response);
									String error = "access_denied"
											.equals(failure instanceof OAuth2AuthenticationException e
													? e.getError().getErrorCode()
													: "") ? "cancelled" : "failed";
									response.sendRedirect(settings.webOrigin + "/oauth/complete?error=" + error);
								}));
		return http.build();
	}
}
