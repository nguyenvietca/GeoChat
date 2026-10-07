package com.geochat.chat;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class ChatIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendRequestRepository friendRequestRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

        @Autowired
        private ChatService chatService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(webApplicationContext.getBean(FilterChainProxy.class))
                .build();
        friendRequestRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void openDirectConversationRequiresFriendshipAndReusesExistingConversation() throws Exception {
        User alice = createUser("alice-chat", "Alice");
        User bob = createUser("bob-chat", "Bob");
        markFriends(alice, bob);

        String first = mockMvc.perform(post("/api/v1/chats/direct")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(bob.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("DIRECT"))
                .andExpect(jsonPath("$.data.participant.userId").value(bob.getId()))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String second = mockMvc.perform(post("/api/v1/chats/direct")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(bob.getId())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        org.junit.jupiter.api.Assertions.assertEquals(
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(first).path("data").path("conversationId").asText(),
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(second).path("data").path("conversationId").asText());
    }

    @Test
    void listAndDetailConversationForAuthenticatedParticipant() throws Exception {
        User alice = createUser("alice-list", "Alice");
        User bob = createUser("bob-list", "Bob");
        markFriends(alice, bob);

        String conversationId = mockMvc.perform(post("/api/v1/chats/direct")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(bob.getId())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String conversationIdValue = new com.fasterxml.jackson.databind.ObjectMapper().readTree(conversationId)
                .path("data").path("conversationId").asText();

        mockMvc.perform(get("/api/v1/chats")
                        .header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].conversationId").value(conversationIdValue))
                .andExpect(jsonPath("$.data.items[0].participant.userId").value(bob.getId()));

        mockMvc.perform(get("/api/v1/chats/{conversationId}", conversationIdValue)
                        .header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.conversationId").value(conversationIdValue))
                .andExpect(jsonPath("$.data.type").value("DIRECT"));
    }

    @Test
    void conversationListIncludesLatestMessagePreview() throws Exception {
        User alice = createUser("alice-preview", "Alice");
        User bob = createUser("bob-preview", "Bob");
        markFriends(alice, bob);
        long conversationId = chatService.openDirectConversation(alice.getUsername(),
                new com.geochat.chat.dto.OpenDirectChatRequest(bob.getId())).conversationId();
        chatService.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("Older message"));
        chatService.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("Latest message"));

        mockMvc.perform(get("/api/v1/chats")
                        .header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].lastMessage").value("Latest message"));
    }

    @Test
    void sendMessageAndReadMessagesWithPagination() throws Exception {
        User alice = createUser("alice-message", "Alice");
        User bob = createUser("bob-message", "Bob");
        markFriends(alice, bob);

        String conversationId = mockMvc.perform(post("/api/v1/chats/direct")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(bob.getId())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String conversationIdValue = new com.fasterxml.jackson.databind.ObjectMapper().readTree(conversationId)
                .path("data").path("conversationId").asText();

        mockMvc.perform(post("/api/v1/chats/{conversationId}/messages", conversationIdValue)
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Hello Bob!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("Hello Bob!"))
                .andExpect(jsonPath("$.data.senderId").value(alice.getId()));

        mockMvc.perform(get("/api/v1/chats/{conversationId}/messages", conversationIdValue)
                        .header("Authorization", bearer(tokenFor(alice)))
                        .param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].content").value("Hello Bob!"));
    }

    @Test
    void loadsMessagePagesFromNewestAndReturnsEachPageInChronologicalOrder() throws Exception {
        User alice = createUser("alice-paged", "Alice");
        User bob = createUser("bob-paged", "Bob");
        markFriends(alice, bob);
        long conversationId = chatService.openDirectConversation(alice.getUsername(),
                new com.geochat.chat.dto.OpenDirectChatRequest(bob.getId())).conversationId();

        for (int messageIndex = 0; messageIndex < 25; messageIndex++) {
            chatService.sendMessage(alice.getUsername(), conversationId,
                    new SendMessageRequest("Message " + messageIndex));
        }

        mockMvc.perform(get("/api/v1/chats/{conversationId}/messages", conversationId)
                        .header("Authorization", bearer(tokenFor(alice)))
                        .param("limit", "10")
                        .param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(25))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.items[0].content").value("Message 15"))
                .andExpect(jsonPath("$.data.items[9].content").value("Message 24"));

        mockMvc.perform(get("/api/v1/chats/{conversationId}/messages", conversationId)
                        .header("Authorization", bearer(tokenFor(alice)))
                        .param("limit", "10")
                        .param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.items[0].content").value("Message 5"))
                .andExpect(jsonPath("$.data.items[9].content").value("Message 14"));
    }

    @Test
    void invalidMessagesRejectedAndNonParticipantsCannotAccess() throws Exception {
        User alice = createUser("alice-invalid", "Alice");
        User bob = createUser("bob-invalid", "Bob");
        markFriends(alice, bob);

        String conversationId = mockMvc.perform(post("/api/v1/chats/direct")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(bob.getId())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String conversationIdValue = new com.fasterxml.jackson.databind.ObjectMapper().readTree(conversationId)
                .path("data").path("conversationId").asText();

        mockMvc.perform(post("/api/v1/chats/{conversationId}/messages", conversationIdValue)
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"   \"}"))
                .andExpect(status().isBadRequest());

        User carol = createUser("carol-chat", "Carol");
        mockMvc.perform(get("/api/v1/chats/{conversationId}", conversationIdValue)
                        .header("Authorization", bearer(tokenFor(carol))))
                .andExpect(status().isForbidden());
    }

    private void markFriends(User first, User second) {
        FriendRequest request = new FriendRequest();
        request.setSenderId(first.getId());
        request.setReceiverId(second.getId());
        request.setStatus(FriendRequestStatus.ACCEPTED);
        request.setCreatedAt(Instant.now());
        request.setUpdatedAt(Instant.now());
        friendRequestRepository.save(request);
    }

    private User createUser(String username, String displayName) {
        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setDisplayName(displayName);
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(Instant.now());
        return userRepository.save(user);
    }

    private String tokenFor(User user) {
        return jwtService.generateToken(user.getId(), user.getUsername());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String jsonBody(Long userId) {
        return "{\"userId\":" + userId + "}";
    }
}
