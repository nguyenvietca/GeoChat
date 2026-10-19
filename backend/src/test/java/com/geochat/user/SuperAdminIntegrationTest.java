package com.geochat.user;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.*;
import com.geochat.chat.service.ChatService;
import com.geochat.chat.repository.ConversationRepository;
import com.geochat.chat.websocket.WebSocketSessionRegistry;
import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.SuperAdminBootstrap;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.context.WebApplicationContext;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test")
class SuperAdminIntegrationTest {
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;
    @Autowired ChatService chats;
    @Autowired ConversationRepository conversations;
    @Autowired PlatformTransactionManager manager;
    @Autowired WebApplicationContext context;
    @Autowired WebSocketSessionRegistry sockets;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    MockMvc mvc; User root, alice, admin;
    @BeforeEach void setup() {
        conversations.deleteAll(); users.deleteAll(); root = user("root", UserRole.SUPER_ADMIN); alice = user("alice", UserRole.USER); admin = user("admin", UserRole.ADMIN);
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
    }
    User user(String name, UserRole role) { User u = new User(); u.setUsername(name); u.setDisplayName(name); u.setRole(role); u.setPasswordHash(passwords.encode("Password123!")); return users.saveAndFlush(u); }
    String bearer(User user) { return "Bearer " + jwt.generateToken(user.getId(), user.getUsername(), user.getAuthVersion()); }
    @Test void overviewCountsDistinctOnlineAndRejectsRegularUsers() throws Exception {
        sockets.registerUsername("root-one", "root", root.getId()); sockets.registerUsername("root-two", "root", root.getId());
        try {
            mvc.perform(get("/api/v1/admin/overview").header("Authorization", bearer(admin))).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.total").value(3)).andExpect(jsonPath("$.data.active").value(3)).andExpect(jsonPath("$.data.online").value(1));
            mvc.perform(get("/api/v1/admin/overview").header("Authorization", bearer(alice))).andExpect(status().isForbidden());
        } finally { sockets.remove("root-one"); sockets.remove("root-two"); }
    }
    @Test void superAdminCanOpenDirectAndSendBeyondFiveButAdminCannotUseOverride() throws Exception {
        mvc.perform(post("/api/v1/admin/users/" + alice.getId() + "/conversation").header("Authorization", bearer(admin))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/admin/users/" + root.getId() + "/block").header("Authorization", bearer(admin))
                .contentType("application/json").content("{\"reason\":\"Cannot block root\"}")).andExpect(status().isBadRequest());
        var chat = chats.openSuperAdminConversation(root.getUsername(), alice.getId());
        for (int i = 0; i < 7; i++) chats.sendMessage("root", chat.conversationId(), new SendMessageRequest("Support " + i));
        assertThat(chats.getConversationDetail("root", chat.conversationId()).limitedMessagesRemaining()).isNull();
        assertThat(chats.listMessages("root", chat.conversationId(), 20).total()).isEqualTo(7);
        assertThatThrownBy(() -> chats.openSuperAdminConversation("admin", alice.getId())).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test void bootstrapUsesSeedOnceAndNeverOverwritesCredentials() {
        users.deleteAll();
        User seed = user("geochat_super_admin", UserRole.SUPER_ADMIN); seed.setPasswordHash("!bootstrap-required"); seed.setPasswordLoginEnabled(false); seed.setStatus(UserStatus.LOCKED); users.saveAndFlush(seed);
        var bootstrap = new SuperAdminBootstrap(users, passwords, true, "operator", "operator@example.com", "LongUniquePassword123!", jdbc);
        new TransactionTemplate(manager).executeWithoutResult(tx -> bootstrap.run(new DefaultApplicationArguments()));
        User configured = users.findByUsernameIgnoreCase("operator").orElseThrow();
        assertThat(configured.getStatus()).isEqualTo(UserStatus.ACTIVE); assertThat(passwords.matches("LongUniquePassword123!", configured.getPasswordHash())).isTrue();
        configured.setStatus(UserStatus.LOCKED); users.saveAndFlush(configured);
        new TransactionTemplate(manager).executeWithoutResult(tx -> bootstrap.run(new DefaultApplicationArguments()));
        assertThat(users.findById(configured.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.LOCKED);
    }
}
