package com.geochat.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.geochat.auth.security.JwtService;
import com.geochat.user.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;

@SpringBootTest
@ActiveProfiles("test")
class AuthFlowIntegrationTest {

    private static final String ALICE_PASSWORD = "Password123!";

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(webApplicationContext.getBean(FilterChainProxy.class))
                .build();
        userRepository.deleteAll();
    }

    @Test
    void registerLoginAndGetCurrentUser() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerRequest("alice", ALICE_PASSWORD, "Alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("alice"))
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(content().string(not(containsString(ALICE_PASSWORD))));

        String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginRequest("alice", ALICE_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(content().string(not(containsString(jwtSecret))))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String accessToken = new ObjectMapper().readTree(loginResponse)
                .path("data")
                .path("token")
                .asText();

        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("alice"))
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(content().string(not(containsString(ALICE_PASSWORD))))
                .andExpect(content().string(not(containsString(jwtSecret))));
    }

    @Test
    void duplicateUserRegistrationShouldFail() throws Exception {
        registerAlice();

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerRequest("alice", ALICE_PASSWORD, "Another Alice")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registrationRejectsInvalidAndMissingRequiredFields() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerRequest("al", "short", "A")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"alice","password":"Password123!"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginRejectsInvalidRequest() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"","password":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void wrongPasswordAndUnknownUserReturnGenericAuthenticationError() throws Exception {
        registerAlice();

        assertInvalidCredentials("alice", "WrongPassword123!");
        assertInvalidCredentials("unknown", ALICE_PASSWORD);
    }

    @Test
    void protectedEndpointRejectsMissingToken() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointRejectsInvalidJwt() throws Exception {
        assertUnauthorizedWithToken("eyJhbGciOiJIUzI1NiJ9.e30.invalid-signature");
    }

    @Test
    void protectedEndpointRejectsMalformedJwt() throws Exception {
        assertUnauthorizedWithToken("not-a-jwt");
    }

    @Test
    void protectedEndpointRejectsExpiredJwt() throws Exception {
        assertUnauthorizedWithToken(createExpiredToken());
    }

    @Test
    void jwtServiceRejectsWeakSecret() {
        assertThrows(IllegalStateException.class, () -> new JwtService("weak-secret", 3600000));
    }

    private void registerAlice() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerRequest("alice", ALICE_PASSWORD, "Alice")))
                .andExpect(status().isOk());
    }

    private void assertInvalidCredentials(String username, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginRequest(username, password)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    private void assertUnauthorizedWithToken(String token) throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    private String createExpiredToken() {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject("alice")
                .issuedAt(Date.from(now.minusSeconds(120)))
                .expiration(Date.from(now.minusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private String registerRequest(String username, String password, String displayName) {
        return """
                {"username":"%s","password":"%s","displayName":"%s"}
                """.formatted(username, password, displayName);
    }

    private String loginRequest(String username, String password) {
        return """
                {"username":"%s","password":"%s"}
                """.formatted(username, password);
    }
}
