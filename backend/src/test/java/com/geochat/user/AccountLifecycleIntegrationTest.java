package com.geochat.user;

import com.geochat.auth.security.*;
import com.geochat.chat.websocket.*;
import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.AccountLifecycleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.socket.WebSocketSession;
import java.util.HashMap;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
class AccountLifecycleIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;
    @Autowired AccountLifecycleService accounts;
    @Autowired JdbcTemplate jdbc;
    @Autowired StompAuthenticationChannelInterceptor stomp;
    @Autowired WebSocketSessionRegistry sockets;
    @Autowired com.geochat.notification.repository.UserPushDeviceRepository devices;
    MockMvc mvc;
    User alice, admin;
    String original, adminToken;

    @BeforeEach void setup() {
        devices.deleteAll(); users.deleteAll(); jdbc.update("DELETE FROM account_actions");
        alice = user("alice", UserRole.USER); admin = user("admin", UserRole.ADMIN);
        original = bearer(alice); adminToken = bearer(admin);
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
    }
    User user(String name, UserRole role) {
        User u = new User(); u.setUsername(name); u.setDisplayName(name);
        u.setPasswordHash(passwords.encode("Password123!")); u.setRole(role); u.setNearbyDiscoverable(true);
        return users.saveAndFlush(u);
    }
    String bearer(User u) { return "Bearer " + jwt.generateToken(u.getId(), u.getUsername(), u.getAuthVersion()); }
    String proof(String password) { return "{\"username\":\"alice\",\"password\":\"" + password + "\"}"; }
    String loginToken() throws Exception {
        var response = mvc.perform(post("/api/v1/auth/login").contentType("application/json").content(proof("Password123!")))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + new ObjectMapper().readTree(response.getResponse().getContentAsString()).path("data").path("token").asText();
    }
    MvcResult decision(boolean block, Long id, String reason, String token) throws Exception {
        return mvc.perform(post("/api/v1/admin/users/" + id + (block ? "/block" : "/unblock"))
                .header("Authorization", token).contentType("application/json")
                .content(new ObjectMapper().writeValueAsString(java.util.Map.of("reason", reason)))).andReturn();
    }

    @Test void deactivateReactivationRevokesOldTokensPermanently() throws Exception {
        mvc.perform(post("/api/v1/users/me/deactivate").header("Authorization", original)
                .contentType("application/json").content("{\"password\":\"Password123!\"}")).andExpect(status().isOk());
        User disabled = users.findById(alice.getId()).orElseThrow();
        assertThat(disabled.getStatus()).isEqualTo(UserStatus.INACTIVE);
        assertThat(disabled.getSelfDeactivatedAt()).isNotNull();
        assertThat(disabled.isNearbyDiscoverable()).isFalse();
        mvc.perform(get("/api/v1/users/me").header("Authorization", original)).andExpect(status().isUnauthorized());
        String restricted = loginToken();
        mvc.perform(post("/api/v1/users/me/reactivate")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/reactivate").contentType("application/json").content(proof("Password123!")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/me").header("Authorization", restricted)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("INACTIVE"));
        for (String path : new String[]{"/api/v1/notifications", "/api/v1/users/search?q=admin", "/api/v1/admin/users", "/api/v1/auth/google/connections"})
            mvc.perform(get(path).header("Authorization", restricted)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/users/me").header("Authorization", restricted).contentType("application/json")
                .content("{\"displayName\":\"Changed\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/chats/1/messages").header("Authorization", restricted).contentType("application/json")
                .content("{\"content\":\"Forbidden\"}")).andExpect(status().isForbidden());
        var connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.setSessionId("inactive-test"); connect.setSessionAttributes(new HashMap<>());
        connect.setNativeHeader("Authorization", restricted); connect.setLeaveMutable(true);
        assertThatThrownBy(() -> stomp.preSend(MessageBuilder.createMessage(new byte[0], connect.getMessageHeaders()), null))
                .isInstanceOf(AccessDeniedException.class);
        var response = mvc.perform(post("/api/v1/users/me/reactivate").header("Authorization", restricted))
                .andExpect(status().isOk()).andReturn();
        String newToken = new ObjectMapper().readTree(response.getResponse().getContentAsString()).path("data").path("token").asText();
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + newToken)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/search").param("q", "admin").header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/me").header("Authorization", restricted)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/users/me/reactivate").header("Authorization", restricted)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/me").header("Authorization", original)).andExpect(status().isUnauthorized());
        assertThat(users.findById(alice.getId()).orElseThrow().isNearbyDiscoverable()).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_actions WHERE user_id = ?", Long.class, alice.getId())).isEqualTo(2);
    }

    @Test void passwordProofRequiredAndUnknownAndWrongPasswordsStayGeneric() throws Exception {
        mvc.perform(post("/api/v1/users/me/deactivate").header("Authorization", original)
                .contentType("application/json").content("{\"password\":\"wrong\"}")).andExpect(status().isBadRequest());
        accounts.deactivate("alice", "Password123!");
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content(proof("wrong")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Invalid username or password"));
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content(proof("wrong").replace("alice", "unknown")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Invalid username or password"));
        assertThat(users.findById(alice.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.INACTIVE);
    }

    @Test void onlyAdminCanModerateAndReasonsRequired() throws Exception {
        mvc.perform(get("/api/v1/admin/users").header("Authorization", original)).andExpect(status().isForbidden());
        assertThat(decision(true, alice.getId(), "Violation", original).getResponse().getStatus()).isEqualTo(403);
        assertThat(decision(true, alice.getId(), " ", adminToken).getResponse().getStatus()).isEqualTo(400);
        assertThat(decision(true, admin.getId(), "Violation", adminToken).getResponse().getStatus()).isEqualTo(400);
        mvc.perform(post("/api/v1/users/me/deactivate").header("Authorization", adminToken)
                .contentType("application/json").content("{\"password\":\"Password123!\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users").param("query", "alice").header("Authorization", adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].username").value("alice"))
                .andExpect(jsonPath("$.data.items[0].passwordHash").doesNotExist());
    }

    @Test void blockedUserCannotLoginOrSelfReactivateOrReuseTokenAfterUnblock() throws Exception {
        assertThat(decision(true, alice.getId(), "Spam", adminToken).getResponse().getStatus()).isEqualTo(200);
        mvc.perform(get("/api/v1/users/me").header("Authorization", original)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content(proof("Password123!")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("This account is blocked. Contact an administrator."));
        mvc.perform(post("/api/v1/users/me/reactivate").header("Authorization", original)).andExpect(status().isUnauthorized());
        assertThat(decision(false, alice.getId(), "Appeal accepted", adminToken).getResponse().getStatus()).isEqualTo(200);
        assertThat(users.findById(alice.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
        mvc.perform(get("/api/v1/users/me").header("Authorization", original)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content(proof("Password123!"))).andExpect(status().isOk());
    }

    @Test void unblockPreservesSelfDeactivation() throws Exception {
        accounts.deactivate("alice", "Password123!");
        assertThat(decision(true, alice.getId(), "Violation", adminToken).getResponse().getStatus()).isEqualTo(200);
        assertThat(decision(false, alice.getId(), "Appeal", adminToken).getResponse().getStatus()).isEqualTo(200);
        assertThat(users.findById(alice.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.INACTIVE);
        mvc.perform(post("/api/v1/users/me/reactivate").header("Authorization", loginToken())).andExpect(status().isOk());
    }

    @Test void closesActiveWebSocketsAndRejectsStaleConnectAndSend() throws Exception {
        WebSocketSession socket = mock(WebSocketSession.class);
        when(socket.getId()).thenReturn("lifecycle-test"); when(socket.isOpen()).thenReturn(true);
        sockets.register(socket);
        var connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.setSessionId("lifecycle-test"); connect.setSessionAttributes(new HashMap<>());
        connect.setNativeHeader("Authorization", original);
        connect.setLeaveMutable(true);
        stomp.preSend(MessageBuilder.createMessage(new byte[0], connect.getMessageHeaders()), null);
        assertThat(sockets.isOnline(alice.getId())).isTrue();
        var attributes = new HashMap<>(connect.getSessionAttributes());
        accounts.deactivate("alice", "Password123!");
        verify(socket).close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION);
        assertThat(sockets.isOnline(alice.getId())).isFalse();
        assertThatThrownBy(() -> stomp.preSend(MessageBuilder.createMessage(new byte[0], connect.getMessageHeaders()), null)).isInstanceOf(AccessDeniedException.class);
        accounts.reactivateSession(alice.getId(), users.findById(alice.getId()).orElseThrow().getAuthVersion());
        var send = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        send.setSessionAttributes(attributes); send.setDestination("/user/queue/notifications");
        assertThatThrownBy(() -> stomp.preSend(MessageBuilder.createMessage(new byte[0], send.getMessageHeaders()), null)).isInstanceOf(AccessDeniedException.class);
    }

    @Test void staleProfileWritesCannotUndoAdminBlockOrRevocation() {
        User staleProfile = users.findById(alice.getId()).orElseThrow();
        accounts.moderate("admin", alice.getId(), true, "Spam");
        staleProfile.setDisplayName("New name");
        assertThatThrownBy(() -> users.saveAndFlush(staleProfile))
                .isInstanceOf(org.springframework.dao.OptimisticLockingFailureException.class);
        User current = users.findById(alice.getId()).orElseThrow();
        assertThat(current.getStatus()).isEqualTo(UserStatus.LOCKED);
        assertThat(current.getAuthVersion()).isEqualTo(1);
    }

    @Test void inactiveAndBlockedUsersDoNotReceivePushNotifications() {
        var device = new com.geochat.notification.entity.UserPushDevice();
        device.setUserId(alice.getId()); device.setPlatform("android"); device.setPushToken("synthetic-test-token");
        devices.saveAndFlush(device);
        assertThat(devices.findByUserIdAndActiveTrue(alice.getId())).hasSize(1);
        accounts.deactivate("alice", "Password123!");
        assertThat(devices.findByUserIdAndActiveTrue(alice.getId())).isEmpty();
        accounts.reactivateSession(alice.getId(), users.findById(alice.getId()).orElseThrow().getAuthVersion());
        accounts.moderate("admin", alice.getId(), true, "Spam");
        assertThat(devices.findByUserIdAndActiveTrue(alice.getId())).isEmpty();
    }

    @Test void registrationAndProfileCannotAssignAdminRole() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType("application/json")
                .content("{\"username\":\"attacker\",\"displayName\":\"Attacker\",\"password\":\"Password123!\",\"role\":\"ADMIN\",\"status\":\"ACTIVE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("USER"));
        mvc.perform(patch("/api/v1/users/me").header("Authorization", original).contentType("application/json")
                .content("{\"displayName\":\"Alice Updated\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("USER"));
    }
}
