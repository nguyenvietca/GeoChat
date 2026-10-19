package com.geochat.auth.password;

import com.geochat.auth.security.JwtService;
import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.AccountLifecycleService;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.password-reset.enabled=true", "app.password-reset.from=noreply@example.com",
        "spring.mail.host=smtp.example.test",
        "app.password-reset.web-origin=https://web.example.test"})
@ActiveProfiles("test")
class PasswordResetIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired PasswordResetTokens tokens;
    @Autowired PasswordResetService resets;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;
    @Autowired AccountLifecycleService accounts;
    @MockitoBean JavaMailSender smtp;
    MockMvc mvc; User alice;
    @BeforeEach void setup() {
        tokens.deleteAll(); users.deleteAll();
        alice = new User(); alice.setUsername("alice"); alice.setDisplayName("Alice");
        alice.setEmail(UUID.randomUUID() + "@example.com"); alice.setPasswordHash(passwords.encode("OldPassword123!"));
        alice = users.saveAndFlush(alice);
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
    }
    String requestLink() throws Exception {
        mvc.perform(post("/api/v1/auth/password/forgot").contentType("application/json")
                .content("{\"email\":\"" + alice.getEmail() + "\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        var capture = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(smtp, timeout(5000)).send(capture.capture());
        assertThat(capture.getValue().getFrom()).isEqualTo("noreply@example.com");
        assertThat(capture.getValue().getText()).contains("https://web.example.test/reset-password#token=");
        return capture.getValue().getText().split("#token=")[1].split("\\s")[0];
    }
    ResultActions reset(String raw) throws Exception {
        return mvc.perform(post("/api/v1/auth/password/reset").contentType("application/json")
                .content("{\"token\":\"" + raw + "\",\"password\":\"NewPassword123!\"}"));
    }
    @Test void emailLinkResetsPasswordOnceAndRevokesOldJwt() throws Exception {
        String old = jwt.generateToken(alice.getId(), alice.getUsername()); String raw = requestLink();
        assertThat(tokens.findAll().getFirst().tokenHash).isEqualTo(PasswordResetService.hash(raw)).isNotEqualTo(raw);
        reset(raw).andExpect(status().isOk()); reset(raw).andExpect(status().isBadRequest());
        User saved = users.findById(alice.getId()).orElseThrow();
        assertThat(passwords.matches("NewPassword123!", saved.getPasswordHash())).isTrue();
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + old)).andExpect(status().isUnauthorized());
        assertThat(tokens.count()).isZero();
    }
    @Test void expiredAndEmailChangedLinksCannotReset() throws Exception {
        String raw = requestLink(); var token = tokens.findAll().getFirst(); token.expiresAt = Instant.now().minusSeconds(1); tokens.saveAndFlush(token);
        reset(raw).andExpect(status().isBadRequest());
        token.expiresAt = Instant.now().plusSeconds(900); tokens.saveAndFlush(token);
        alice.setEmail("changed@example.com"); users.saveAndFlush(alice);
        reset(raw).andExpect(status().isBadRequest());
        assertThat(passwords.matches("OldPassword123!", users.findById(alice.getId()).orElseThrow().getPasswordHash())).isTrue();
    }
    @Test void resetKeepsSelfDeactivationAndCannotBypassBlock() throws Exception {
        accounts.deactivate("alice", "OldPassword123!"); String raw = requestLink(); reset(raw).andExpect(status().isOk());
        assertThat(users.findById(alice.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.INACTIVE);
        // A link issued before an administrator block must also become unusable.
        var token = new PasswordResetToken(); token.userId = alice.getId(); token.email = alice.getEmail();
        token.tokenHash = PasswordResetService.hash("a".repeat(43)); token.authVersion = users.findById(alice.getId()).orElseThrow().getAuthVersion();
        token.expiresAt = Instant.now().plusSeconds(900); tokens.saveAndFlush(token);
        User admin = new User(); admin.setUsername("admin"); admin.setDisplayName("Admin"); admin.setPasswordHash(passwords.encode("Password123!")); admin.setRole(UserRole.ADMIN); users.saveAndFlush(admin);
        accounts.moderate("admin", alice.getId(), true, "Violation"); reset("a".repeat(43)).andExpect(status().isBadRequest());
    }
    @Test void unknownGoogleOnlyAndLockedAccountsHaveTheSameNeutralResponse() throws Exception {
        alice.setPasswordLoginEnabled(false); users.saveAndFlush(alice);
        User locked = new User(); locked.setUsername("locked"); locked.setDisplayName("Locked"); locked.setEmail("locked@example.com");
        locked.setPasswordHash(passwords.encode("OldPassword123!")); locked.setStatus(UserStatus.LOCKED); users.saveAndFlush(locked);
        for (String email : new String[]{"unknown@example.com", alice.getEmail(), locked.getEmail()})
            mvc.perform(post("/api/v1/auth/password/forgot").contentType("application/json").content("{\"email\":\"" + email + "\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        verify(smtp, after(250).never()).send(any(SimpleMailMessage.class));
    }
}
