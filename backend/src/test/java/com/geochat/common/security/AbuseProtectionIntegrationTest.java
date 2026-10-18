package com.geochat.common.security;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.OpenDirectChatRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import com.geochat.chat.repository.MessageRepository;
import com.geochat.chat.websocket.ChatWebSocketController;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Import;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.security.rate-limit.enabled=true",
        "app.security.registration-bot-check.enabled=true",
        "app.security.registration-bot-check.site-key=production-site-key",
        "app.security.registration-bot-check.secret=valid-private-key",
        "app.security.registration-bot-check.hostnames=localhost"})
@ActiveProfiles("test")
@Import(AbuseProtectionIntegrationTest.FixedTime.class)
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class AbuseProtectionIntegrationTest {
    @TestConfiguration static class FixedTime {
        @Bean @Primary MessageSendGuard testSendGuard() {
            return new MessageSendGuard(true, new SlidingRequestLimits(new SecurityLimitsTest.Time()));
        }
    }
    @Autowired WebApplicationContext context;
    @Autowired ChatService chat;
    @Autowired ChatWebSocketController socket;
    @Autowired UserRepository users;
    @Autowired FriendRequestRepository friendships;
    @Autowired MessageRepository messages;
    @Autowired JwtService jwt;

    @Test void directRegistrationWithoutProofCannotBypassEnabledBotCheck() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
        mvc.perform(get("/api/v1/auth/registration-config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.siteKey").value("production-site-key"))
                .andExpect(jsonPath("$.data.secret").doesNotExist());
        mvc.perform(post("/api/v1/auth/register").with(request -> { request.setRemoteAddr("192.0.2.201"); return request; })
                .contentType("application/json").content("{\"username\":\"without-proof\",\"password\":\"Password123!\",\"displayName\":\"Test user\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("verification failed")));
        assertThat(users.existsByUsernameIgnoreCase("without-proof")).isFalse();
    }

    @Test void restWebsocketAndImagesShareOneBudgetAndRejectedSendsDoNotPersist() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
        var alice = user("abuse-alice"); var bob = user("abuse-bob");
        var friend = new FriendRequest(); friend.setSenderId(alice.getId()); friend.setReceiverId(bob.getId());
        friend.setStatus(FriendRequestStatus.ACCEPTED); friendships.save(friend);
        Long conversation = chat.openDirectConversation(alice.getUsername(),new OpenDirectChatRequest(bob.getId())).conversationId();
        String path = "/api/v1/chats/" + conversation + "/messages";
        String bearer = "Bearer " + jwt.generateToken(alice.getId(),alice.getUsername());
        for (int i=0; i<4; i++) mvc.perform(post(path).header("Authorization",bearer)
                .contentType("application/json").content("{\"content\":\"REST message\"}")).andExpect(status().isOk());
        socket.sendMessage(conversation,new SendMessageRequest("Socket message"),alice::getUsername,null);
        long count = messages.count();
        mvc.perform(post(path).header("Authorization",bearer).contentType("application/json").content("{\"content\":\"Too fast\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After","1"));
        assertThatThrownBy(() -> socket.sendMessage(conversation,new SendMessageRequest("Too fast"),alice::getUsername,null))
                .isInstanceOf(RequestLimitException.class);
        assertThatThrownBy(() -> chat.sendImage(alice.getUsername(),conversation,null,"",null,java.util.UUID.randomUUID().toString()))
                .isInstanceOf(RequestLimitException.class);
        assertThat(messages.count()).isEqualTo(count);
        assertThatCode(() -> socket.sendMessage(conversation,new SendMessageRequest("Other user"),bob::getUsername,null)).doesNotThrowAnyException();
    }

    private User user(String name) {
        User user = new User(); user.setUsername(name); user.setDisplayName(name); user.setPasswordHash("unused-synthetic-hash");
        return users.save(user);
    }
}
