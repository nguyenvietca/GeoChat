package com.geochat.auth.google;

import com.geochat.auth.security.JwtService;
import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = { "google.enabled=true", "google.client-id=test.apps.googleusercontent.com",
		"google.client-secret=synthetic-client-secret-only" })
@ActiveProfiles("test")
@Import(GoogleAuthIntegrationTest.Provider.class)
class GoogleAuthIntegrationTest {
	static final String ORIGIN = "http://localhost:8081", CLIENT = "test.apps.googleusercontent.com";
	static RSAKey signingKey;
	static HttpServer provider;
	static volatile String nonce, challenge, invalid = "";
	static volatile boolean pkceReceived;
	static {
		try {
			signingKey = new RSAKeyGenerator(2048).keyID("test-key").generate();
			provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			provider.createContext("/keys", exchange -> {
				byte[] body = new JWKSet(signingKey.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
				exchange.getResponseHeaders().set("Content-Type", "application/json");
				exchange.sendResponseHeaders(200, body.length);
				exchange.getResponseBody().write(body);
				exchange.close();
			});
			provider.createContext("/token", exchange -> {
				try {
					var form = query(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
					String verifier = form.get("code_verifier");
					pkceReceived = verifier != null && Base64.getUrlEncoder().withoutPadding().encodeToString(
							MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)))
							.equals(challenge);
					if (!pkceReceived)
						throw new IllegalArgumentException("PKCE missing");
					Instant now = Instant.now();
					var claims = new JWTClaimsSet.Builder()
							.issuer(invalid.equals("issuer") ? "https://attacker.invalid"
									: "https://accounts.google.com")
							.audience(invalid.equals("audience") ? "wrong-client" : CLIENT).subject("google-subject-1")
							.issueTime(Date.from(now.minusSeconds(30)))
							.expirationTime(Date.from(now.plusSeconds(invalid.equals("expired") ? -600 : 600)))
							.claim("nonce", invalid.equals("nonce") ? "wrong-nonce" : nonce)
							.claim("email", "google@example.com").claim("email_verified", !invalid.equals("unverified"))
							.claim("name", "Google Test").build();
					var signed = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(),
							claims);
					signed.sign(new RSASSASigner(
							invalid.equals("signature") ? new RSAKeyGenerator(2048).generate() : signingKey));
					byte[] body = ("{\"access_token\":\"provider-token-not-for-geochat\",\"token_type\":\"Bearer\",\"expires_in\":600,\"scope\":\"openid email profile\",\"id_token\":\""
							+ signed.serialize() + "\"}").getBytes(StandardCharsets.UTF_8);
					exchange.getResponseHeaders().set("Content-Type", "application/json");
					exchange.sendResponseHeaders(200, body.length);
					exchange.getResponseBody().write(body);
				} catch (Exception failure) {
					exchange.sendResponseHeaders(400, -1);
				} finally {
					exchange.close();
				}
			});
			provider.createContext("/userinfo", exchange -> {
				byte[] body = "{\"sub\":\"google-subject-1\",\"email\":\"google@example.com\",\"email_verified\":true,\"name\":\"Google Test\"}"
						.getBytes(StandardCharsets.UTF_8);
				exchange.getResponseHeaders().set("Content-Type", "application/json");
				exchange.sendResponseHeaders(200, body.length);
				exchange.getResponseBody().write(body);
				exchange.close();
			});
			provider.start();
		} catch (Exception failure) {
			throw new ExceptionInInitializerError(failure);
		}
	}

	@TestConfiguration
	static class Provider {
		@Bean
		@Primary
		ClientRegistrationRepository mockedGoogle() {
			String base = "http://127.0.0.1:" + provider.getAddress().getPort();
			return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("google")
					.clientId(CLIENT).clientSecret("synthetic-client-secret-only")
					.clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
					.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
					.redirectUri(ORIGIN + "/api/login/oauth2/code/google").scope("openid", "email", "profile")
					.authorizationUri(base + "/authorize").tokenUri(base + "/token").jwkSetUri(base + "/keys")
					.issuerUri("https://accounts.google.com").userInfoUri(base + "/userinfo")
					.userNameAttributeName("sub").build());
		}
	}

	@Autowired
	WebApplicationContext context;
	@Autowired
	UserRepository users;
	@Autowired
	GoogleIdentityRepository identities;
	@Autowired
	GoogleAccounts accounts;
	@Autowired
	PasswordEncoder passwords;
	@Autowired
	JwtService jwt;
	@org.springframework.beans.factory.annotation.Value("${jwt.secret}")
	String jwtSecret;
	MockMvc mvc;
	final ObjectMapper json = new ObjectMapper();

	@BeforeEach
	void setup() {
		identities.deleteAll();
		users.deleteAll();
		invalid = "";
		pkceReceived = false;
		mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
	}

	@AfterEach
	void cleanup() {
		identities.deleteAll();
		users.deleteAll();
	}

	@AfterAll
	static void stopProvider() {
		provider.stop(0);
	}

	static Map<String, String> query(String text) {
		Map<String, String> result = new HashMap<>();
		for (String part : text.split("&")) {
			String[] kv = part.split("=", 2);
			if (kv.length == 2)
				result.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
						URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
		}
		return result;
	}

	Cookie cookie(MvcResult result) {
		String value = result.getResponse().getHeader("Set-Cookie").split(";", 2)[0].split("=", 2)[1];
		return new Cookie(GoogleFlows.COOKIE, value);
	}

	record Started(Cookie cookie, String state) {
	}

	Started start(String token, String password) throws Exception {
		var request = post("/api/v1/auth/google/" + (token == null ? "start" : "link")).header("Origin", ORIGIN)
				.contentType("application/json")
				.content(json.writeValueAsString(Map.of("password", password == null ? "" : password)));
		if (token != null)
			request.header("Authorization", "Bearer " + token);
		var begun = mvc.perform(request).andExpect(status().isOk()).andReturn();
		Cookie cookie = cookie(begun);
		var authorization = mvc.perform(get("/api/oauth2/authorization/google").cookie(cookie))
				.andExpect(status().is3xxRedirection()).andReturn();
		var params = query(URI.create(authorization.getResponse().getRedirectedUrl()).getRawQuery());
		nonce = params.get("nonce");
		challenge = params.get("code_challenge");
		assertThat(params.get("code_challenge_method")).isEqualTo("S256");
		assertThat(params.get("scope")).contains("openid", "email", "profile");
		assertThat(params).doesNotContainKeys("access_type", "refresh_token");
		assertThat(params).doesNotContainKeys("client_secret", "access_token", "id_token");
		assertThat(begun.getResponse().getHeader("Set-Cookie")).contains("HttpOnly", "SameSite=Lax");
		return new Started(cookie, params.get("state"));
	}

	MvcResult callback(Started start) throws Exception {
		return mvc.perform(get("/api/login/oauth2/code/google").cookie(start.cookie()).param("state", start.state())
				.param("code", "synthetic-code")).andExpect(status().is3xxRedirection()).andReturn();
	}

	MvcResult complete(MvcResult callback, String token) throws Exception {
		var request = post("/api/v1/auth/google/complete").header("Origin", ORIGIN).cookie(cookie(callback));
		if (token != null)
			request.header("Authorization", "Bearer " + token);
		return mvc.perform(request).andReturn();
	}

	User passwordUser(String name) {
		User user = new User();
		user.setUsername(name);
		user.setDisplayName(name);
		user.setPasswordHash(passwords.encode("Password123!"));
		return users.saveAndFlush(user);
	}

	GoogleAccounts.Claims claims(String sub, String email) {
		return new GoogleAccounts.Claims(sub, email, true, "Test");
	}

	@Test
	void oidcCallbackPkceCompletionAndReplay() throws Exception {
		var start = start(null, null);
		var returned = callback(start);
		assertThat(pkceReceived).isTrue();
		assertThat(returned.getResponse().getRedirectedUrl()).isEqualTo(ORIGIN + "/oauth/complete");
		assertThat(returned.getResponse().getHeader("Location")).doesNotContain("token", "ticket", "code=");
		mvc.perform(get("/api/v1/users/me").cookie(cookie(returned))).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer provider-token-not-for-geochat"))
				.andExpect(status().isUnauthorized());
		var completed = complete(returned, null);
		assertThat(completed.getResponse().getStatus()).isEqualTo(200);
		String token = json.readTree(completed.getResponse().getContentAsString()).path("data").path("token").asText();
		assertThat(jwt.isTokenValid(token)).isTrue();
		assertThat(users.count()).isEqualTo(1);
		assertThat(identities.count()).isEqualTo(1);
		assertThat(complete(returned, null).getResponse().getStatus()).isEqualTo(400);
		assertThat(callback(start).getResponse().getRedirectedUrl()).contains("error=failed");
		assertThat(completed.getResponse().getContentAsString()).doesNotContain("provider-token-not-for-geochat",
				"id_token", "synthetic-code");
	}

	@ParameterizedTest
	@ValueSource(strings = { "issuer", "audience", "expired", "nonce", "signature", "unverified" })
	void rejectsInvalidOidcIdentity(String problem) throws Exception {
		var start = start(null, null);
		invalid = problem;
		assertThat(callback(start).getResponse().getRedirectedUrl()).contains("error=failed");
		assertThat(users.count()).isZero();
		assertThat(identities.count()).isZero();
	}

	@Test
	void stateAndBrowserBindingCancellationAndCrossOrigin() throws Exception {
		var start = start(null, null);
		mvc.perform(get("/api/login/oauth2/code/google").cookie(start.cookie()).param("state", "attacker").param("code",
				"synthetic-code")).andExpect(redirectedUrl(ORIGIN + "/oauth/complete?error=failed"));
		mvc.perform(post("/api/v1/auth/google/start").header("Origin", "https://attacker.invalid"))
				.andExpect(status().isForbidden());
		mvc.perform(get("/api/login/oauth2/code/google").param("state", start.state()).param("code", "synthetic-code"))
				.andExpect(redirectedUrl(ORIGIN + "/oauth/complete?error=failed"));
		start = start(null, null);
		mvc.perform(get("/api/login/oauth2/code/google").cookie(start.cookie()).param("state", start.state())
				.param("error", "access_denied")).andExpect(redirectedUrl(ORIGIN + "/oauth/complete?error=cancelled"));
	}

	@Test
	void linkingRequiresPasswordSameSessionAndDoesNotChangeUserId() throws Exception {
		User user = passwordUser("existing");
		String token = jwt.generateToken(user.getId(), user.getUsername());
		mvc.perform(post("/api/v1/auth/google/link").header("Origin", ORIGIN).contentType("application/json")
				.content("{\"password\":\"Password123!\"}")).andExpect(status().isUnauthorized());
		var returned = callback(start(token, "Password123!"));
		assertThat(complete(returned, null).getResponse().getStatus()).isEqualTo(401);
		returned = callback(start(token, "Password123!"));
		assertThat(complete(returned, token).getResponse().getStatus()).isEqualTo(200);
		assertThat(identities.findAll().getFirst().userId).isEqualTo(user.getId());
		assertThat(users.count()).isEqualTo(1);
		mvc.perform(get("/api/v1/auth/google/connections").header("Authorization", "Bearer " + token))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.googleConnected").value(true))
				.andExpect(jsonPath("$.data.email").value("google@example.com"))
				.andExpect(jsonPath("$.data.subject").doesNotExist());
		mvc.perform(post("/api/v1/auth/google/unlink").header("Authorization", "Bearer " + token)
				.header("Origin", ORIGIN).contentType("application/json").content("{\"password\":\"wrong\"}"))
				.andExpect(status().isBadRequest());
		assertThat(identities.count()).isEqualTo(1);
		mvc.perform(post("/api/v1/auth/google/unlink").header("Authorization", "Bearer " + token)
				.header("Origin", ORIGIN).contentType("application/json").content("{\"password\":\"Password123!\"}"))
				.andExpect(status().isOk());
		assertThat(identities.count()).isZero();
		assertThat(users.findById(user.getId())).isPresent();
		mvc.perform(post("/api/v1/auth/login").contentType("application/json")
				.content("{\"username\":\"existing\",\"password\":\"Password123!\"}")).andExpect(status().isOk())
				.andExpect(jsonPath("$.data.token").isNotEmpty());
	}

	@Test
	void rejectsCrossAccountCompletionAndDisabledDuringLink() throws Exception {
		User alice = passwordUser("alice"), bob = passwordUser("bob");
		String token = jwt.generateToken(alice.getId(), alice.getUsername());
		var returned = callback(start(token, "Password123!"));
		assertThat(complete(returned, jwt.generateToken(bob.getId(), bob.getUsername())).getResponse().getStatus())
				.isEqualTo(401);
		returned = callback(start(token, "Password123!"));
		String otherSession = new JwtService(jwtSecret, 7200000).generateToken(alice.getId(), alice.getUsername());
		assertThat(complete(returned, otherSession).getResponse().getStatus()).isEqualTo(401);
		returned = callback(start(token, "Password123!"));
		alice.setStatus(UserStatus.LOCKED);
		users.saveAndFlush(alice);
		assertThat(complete(returned, token).getResponse().getStatus()).isEqualTo(401);
		assertThat(identities.count()).isZero();
	}

	@Test
	void subjectIsStableNoEmailAutoMergeAndFinalMethodIsProtected() {
		User existing = passwordUser("existing");
		existing.setEmail("collision@example.com");
		users.saveAndFlush(existing);
		assertThatThrownBy(() -> accounts.resolve(claims("new", "COLLISION@example.com"), null))
				.isInstanceOf(IllegalArgumentException.class);
		assertThat(identities.count()).isZero();
		assertThat(users.count()).isEqualTo(1);
		User created = accounts.resolve(claims("subject", "first@example.com"), null);
		assertThat(accounts.resolve(claims("subject", "changed@example.com"), null).getId()).isEqualTo(created.getId());
		assertThatThrownBy(() -> accounts.unlink(created.getUsername(), "anything"))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> accounts.resolve(claims("subject", "first@example.com"), existing.getId()))
				.isInstanceOf(IllegalArgumentException.class);
		created.setStatus(UserStatus.INACTIVE);
		users.saveAndFlush(created);
		assertThatThrownBy(() -> accounts.resolve(claims("subject", "first@example.com"), null))
				.isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);
	}

	@Test
	void simultaneousFirstLoginLeavesOneUserAndIdentity() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		var gate = new CountDownLatch(1);
		try {
			Callable<Long> login = () -> {
				gate.await();
				return accounts.resolve(claims("concurrent", "concurrent@example.com"), null).getId();
			};
			var first = pool.submit(login);
			var second = pool.submit(login);
			gate.countDown();
			assertThat(first.get(15, TimeUnit.SECONDS)).isEqualTo(second.get(15, TimeUnit.SECONDS));
			assertThat(users.count()).isEqualTo(1);
			assertThat(identities.count()).isEqualTo(1);
		} finally {
			pool.shutdownNow();
		}
	}

	@Test
	void logoutAndExpiredSessionCancelLinking() throws Exception {
		User user = passwordUser("logout-user");
		String token = jwt.generateToken(user.getId(), user.getUsername());
		var returned = callback(start(token, "Password123!"));
		mvc.perform(post("/api/v1/auth/google/cancel").header("Origin", ORIGIN).cookie(cookie(returned)))
				.andExpect(status().isOk());
		assertThat(complete(returned, token).getResponse().getStatus()).isEqualTo(400);
		assertThat(identities.count()).isZero();
		String expired = new JwtService(jwtSecret, -120000).generateToken(user.getId(), user.getUsername());
		mvc.perform(
				post("/api/v1/auth/google/link").header("Origin", ORIGIN).header("Authorization", "Bearer " + expired)
						.contentType("application/json").content("{\"password\":\"Password123!\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void emailCollisionNeverIssuesExistingAccountJwt() throws Exception {
		User user = passwordUser("existing-email");
		user.setEmail("google@example.com");
		users.saveAndFlush(user);
		var result = complete(callback(start(null, null)), null);
		assertThat(result.getResponse().getStatus()).isEqualTo(400);
		assertThat(result.getResponse().getContentAsString()).doesNotContain("\"token\"", "existing-email");
		assertThat(users.count()).isEqualTo(1);
		assertThat(identities.count()).isZero();
	}

	@Test
	void existingLinkIsIdempotentButDifferentSubjectIsRejected() {
		User user = passwordUser("linked");
		assertThat(accounts.resolve(claims("first", "verified@example.com"), user.getId()).getId())
				.isEqualTo(user.getId());
		assertThat(accounts.resolve(claims("first", "verified@example.com"), user.getId()).getId())
				.isEqualTo(user.getId());
		assertThatThrownBy(() -> accounts.resolve(claims("different", "verified@example.com"), user.getId()))
				.isInstanceOf(IllegalArgumentException.class);
		assertThat(identities.count()).isEqualTo(1);
		assertThatThrownBy(() -> accounts.unlink(user.getUsername(), "wrong-password"))
				.isInstanceOf(IllegalArgumentException.class);
		user.setStatus(UserStatus.LOCKED);
		users.saveAndFlush(user);
		assertThatThrownBy(() -> accounts.reauthenticate(user.getUsername(), "Password123!"))
				.isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);
	}

	@Test
	void concurrentCrossAccountLinkCannotTransferIdentity() throws Exception {
		User first = passwordUser("first-owner"), second = passwordUser("second-owner");
		var pool = Executors.newFixedThreadPool(2);
		var gate = new CountDownLatch(1);
		try {
			var attempts = java.util.List.of(first.getId(), second.getId()).stream().map(id -> pool.submit(() -> {
				gate.await();
				try {
					accounts.resolve(claims("one-google", "one@example.com"), id);
					return true;
				} catch (IllegalArgumentException conflict) {
					return false;
				}
			})).toList();
			gate.countDown();
			int successes = 0;
			for (var attempt : attempts)
				if (attempt.get(15, TimeUnit.SECONDS))
					successes++;
			assertThat(successes).isEqualTo(1);
			assertThat(identities.count()).isEqualTo(1);
			assertThat(users.count()).isEqualTo(2);
		} finally {
			pool.shutdownNow();
		}
	}
}
