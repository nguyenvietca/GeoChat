package com.geochat.chat;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import com.geochat.chat.service.GroupService;
import com.geochat.chat.dto.CreateGroupRequest;
import com.geochat.chat.repository.ConversationParticipantRepository;
import com.geochat.chat.repository.ConversationRepository;
import com.geochat.chat.repository.MessageRepository;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import com.geochat.location.entity.UserLocation;
import com.geochat.location.repository.UserLocationRepository;
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
        private ConversationRepository conversationRepository;

        @Autowired
        private ConversationParticipantRepository participantRepository;

        @Autowired
        private MessageRepository messageRepository;

        @Autowired
        private UserLocationRepository locationRepository;

    @Autowired
    private FriendRequestRepository friendRequestRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

        @Autowired
        private ChatService chatService;

        @Autowired
        private GroupService groupService;

    @Autowired
    private jakarta.persistence.EntityManagerFactory entityManagerFactory;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(webApplicationContext.getBean(FilterChainProxy.class))
                .build();
        messageRepository.deleteAll();
        participantRepository.deleteAll();
        conversationRepository.deleteAll();
        locationRepository.deleteAll();
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
    void nearbyNonFriendsCanEachSendFiveMessagesButDistantUsersCannotOpenChat() throws Exception {
        User alice = createUser("nearby-chat-alice", "Alice");
        User bob = createUser("nearby-chat-bob", "Bob");
        User distant = createUser("nearby-chat-distant", "Distant");
        locationRepository.saveAll(java.util.List.of(
                buildLocation(alice.getId(), 0.0, 0.0),
                buildLocation(bob.getId(), 0.01, 0.0),
                buildLocation(distant.getId(), 0.2, 0.0)));

        mockMvc.perform(post("/api/v1/chats/direct")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(bob.getId())))
                .andExpect(status().isBadRequest());

        String response = mockMvc.perform(post("/api/v1/chats/contextual")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + bob.getId() + ",\"radiusMeters\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("DIRECT"))
                .andReturn().getResponse().getContentAsString();
        long conversationId = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response)
                .path("data").path("conversationId").asLong();

        mockMvc.perform(get("/api/v1/chats/{conversationId}", conversationId)
                        .header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.limitedMessagesRemaining").value(5));
        mockMvc.perform(post("/api/v1/chats/contextual")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + distant.getId() + ",\"radiusMeters\":5000}"))
                .andExpect(status().isForbidden());

        for (int messageNumber = 0; messageNumber < 5; messageNumber++) {
            mockMvc.perform(post("/api/v1/chats/{conversationId}/messages", conversationId)
                            .header("Authorization", bearer(tokenFor(alice)))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"content\":\"Alice " + messageNumber + "\"}"))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/api/v1/chats/{id}", conversationId).header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.limitedMessagesRemaining").value(0));
        mockMvc.perform(get("/api/v1/chats/{id}", conversationId).header("Authorization", bearer(tokenFor(bob))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.limitedMessagesRemaining").value(5));
        for (int messageNumber = 0; messageNumber < 5; messageNumber++) {
            mockMvc.perform(post("/api/v1/chats/{conversationId}/messages", conversationId)
                            .header("Authorization", bearer(tokenFor(bob)))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"content\":\"Bob " + messageNumber + "\"}"))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(post("/api/v1/chats/{conversationId}/messages", conversationId)
                        .header("Authorization", bearer(tokenFor(bob)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Sixth message\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void becomingFriendsAfterALimitedChatReusesOneUnlimitedConversation() throws Exception {
        User alice = createUser("limited-then-friend-alice", "Alice");
        User bob = createUser("limited-then-friend-bob", "Bob");
        locationRepository.saveAll(java.util.List.of(
                buildLocation(alice.getId(), 0.0, 0.0), buildLocation(bob.getId(), 0.01, 0.0)));
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        String limited = mockMvc.perform(post("/api/v1/chats/contextual")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + bob.getId() + ",\"radiusMeters\":5000}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long limitedId = mapper.readTree(limited).path("data").path("conversationId").asLong();
        markFriends(alice, bob);

        String friend = mockMvc.perform(post("/api/v1/chats/direct")
                        .header("Authorization", bearer(tokenFor(alice)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(bob.getId())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertEquals(limitedId,
                mapper.readTree(friend).path("data").path("conversationId").asLong());
        mockMvc.perform(get("/api/v1/chats").header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1));
        mockMvc.perform(get("/api/v1/chats/{id}", limitedId).header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.limitedMessagesRemaining").doesNotExist());
    }

        @Test
        void membersOfTheSameGroupCanOpenAContextualChatWithoutLocationSharing() throws Exception {
                User owner = createUser("context-group-owner", "Owner");
                User member = createUser("context-group-member", "Member");
                markFriends(owner, member);
                groupService.createGroup(owner.getUsername(), new CreateGroupRequest("Shared group", java.util.List.of(member.getId())));

                mockMvc.perform(post("/api/v1/chats/contextual")
                                                .header("Authorization", bearer(tokenFor(member)))
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("{\"userId\":" + owner.getId() + "}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.type").value("DIRECT"));
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
        mockMvc.perform(get("/api/v1/chats/{conversationId}/presence", conversationIdValue)
                        .header("Authorization", bearer(tokenFor(carol))))
                .andExpect(status().isForbidden());
    }

    @Test
    void summariesUseActualLatestMessageTimeAndBatchDataForDirectAndOwnerOnlyGroups() throws Exception {
        User alice = createUser("summary-alice", "Alice");
        User bob = createUser("summary-bob", "Bob");
        User outsider = createUser("summary-outsider", "Outsider");
        markFriends(alice, bob);
        Long directId = chatService.openDirectConversation(alice.getUsername(),
                new com.geochat.chat.dto.OpenDirectChatRequest(bob.getId())).conversationId();
        Long groupId = groupService.createGroup(alice.getUsername(),
                new CreateGroupRequest("Owner only", java.util.List.of())).groupId();
        var direct = conversationRepository.findById(directId).orElseThrow();
        direct.setUpdatedAt(Instant.parse("2030-01-01T00:00:00Z"));
        conversationRepository.save(direct);
        var first = new com.geochat.chat.entity.Message();
        first.setConversationId(directId); first.setSenderId(bob.getId()); first.setContent("Earlier");
        first.setCreatedAt(Instant.parse("2020-01-01T00:00:00Z"));
        messageRepository.save(first);
        var latest = new com.geochat.chat.entity.Message();
        latest.setConversationId(directId); latest.setSenderId(alice.getId()); latest.setContent("Latest");
        latest.setCreatedAt(first.getCreatedAt());
        latest = messageRepository.save(latest);
        var items = chatService.listConversations(alice.getUsername()).items();
        org.assertj.core.api.Assertions.assertThat(items).hasSize(2);
        org.assertj.core.api.Assertions.assertThat(items.get(0).conversationId()).isEqualTo(groupId);
        org.assertj.core.api.Assertions.assertThat(items.get(0).lastMessage()).isNull();
        org.assertj.core.api.Assertions.assertThat(items.get(0).groupName()).isEqualTo("Owner only");
        org.assertj.core.api.Assertions.assertThat(items.get(1).lastMessage()).isEqualTo("Latest");
        org.assertj.core.api.Assertions.assertThat(items.get(1).lastMessageId()).isEqualTo(latest.getId());
        org.assertj.core.api.Assertions.assertThat(items.get(1).lastMessageAt()).isEqualTo(latest.getCreatedAt());
        org.assertj.core.api.Assertions.assertThat(items.get(1).lastMessageSender()).isEqualTo("Alice");
        org.assertj.core.api.Assertions.assertThat(chatService.listConversations(outsider.getUsername()).items()).isEmpty();
        mockMvc.perform(get("/api/v1/chats").header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[1].participant.displayName").value("Bob"))
                .andExpect(jsonPath("$.data.items[1].lastMessage").value("Latest"))
                .andExpect(jsonPath("$.data.items[1].updatedAt").value("2030-01-01T00:00:00Z"))
                .andExpect(jsonPath("$.data.items[1].lastMessageAt").value("2020-01-01T00:00:00Z"));
    }

    @Test
    void summaryQueryCountDoesNotGrowWithTheNumberOfGroups() {
        User owner = createUser("batch-owner", "Owner");
        for (int index = 0; index < 8; index++) {
            groupService.createGroup(owner.getUsername(), new CreateGroupRequest("Group " + index, java.util.List.of()));
        }
        var statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            org.assertj.core.api.Assertions.assertThat(chatService.listConversations(owner.getUsername()).items()).hasSize(8);
            org.assertj.core.api.Assertions.assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(6);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    @Test
    void discoveryAllowsNonFriendsWithoutLocationAndReusesTheirLimitedChat() throws Exception {
        User alice = createUser("discovery-alice", "Alice");
        User bob = createUser("discovery-bob", "Bob");
        mockMvc.perform(post("/api/v1/chats/discovery").contentType(MediaType.APPLICATION_JSON).content(jsonBody(bob.getId())))
                .andExpect(status().isUnauthorized());
        var result = mockMvc.perform(post("/api/v1/chats/discovery").header("Authorization", bearer(tokenFor(alice)))
                .contentType(MediaType.APPLICATION_JSON).content(jsonBody(bob.getId())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(result).path("data").path("conversationId").asLong();
        org.assertj.core.api.Assertions.assertThat(chatService.openDiscoveryConversation(bob.getUsername(),
                new com.geochat.chat.dto.OpenDirectChatRequest(alice.getId())).conversationId()).isEqualTo(id);
        mockMvc.perform(get("/api/v1/chats/{id}", id).header("Authorization", bearer(tokenFor(alice))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.limitedMessagesRemaining").value(5));
        mockMvc.perform(post("/api/v1/chats/discovery").header("Authorization", bearer(tokenFor(alice)))
                .contentType(MediaType.APPLICATION_JSON).content(jsonBody(alice.getId())))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/chats/discovery").header("Authorization", bearer(tokenFor(alice)))
                .contentType(MediaType.APPLICATION_JSON).content(jsonBody(Long.MAX_VALUE)))
                .andExpect(status().isNotFound());
    }

    @Test
    void concurrentRestAndStompSendsCannotExceedFiveAndFriendshipUnlocksTheExistingChat() throws Exception {
        User alice = createUser("quota-alice", "Alice");
        User bob = createUser("quota-bob", "Bob");
        Long id = chatService.openDiscoveryConversation(alice.getUsername(),
                new com.geochat.chat.dto.OpenDirectChatRequest(bob.getId())).conversationId();
        for (int index = 0; index < 4; index++) chatService.sendMessage(alice.getUsername(), id, new SendMessageRequest("Before " + index));
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            var rest = pool.submit(() -> {
                start.await();
                try { chatService.sendMessage(alice.getUsername(), id, new SendMessageRequest("REST last slot")); return true; }
                catch (IllegalArgumentException expected) { return false; }
            });
            var stomp = pool.submit(() -> {
                start.await();
                try { chatService.sendMessageFromWebSocket(alice.getUsername(), id, "STOMP last slot"); return true; }
                catch (IllegalArgumentException expected) { return false; }
            });
            start.countDown();
            org.assertj.core.api.Assertions.assertThat(rest.get(10, java.util.concurrent.TimeUnit.SECONDS)
                    ^ stomp.get(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        } finally { pool.shutdownNow(); }
        org.assertj.core.api.Assertions.assertThat(messageRepository.countByConversationId(id)).isEqualTo(5);
        org.assertj.core.api.Assertions.assertThat(chatService.getConversationDetail(alice.getUsername(), id).limitedMessagesRemaining()).isZero();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> chatService.sendMessageFromWebSocket(alice.getUsername(), id, "Sixth"))
                .isInstanceOf(IllegalArgumentException.class);
        org.assertj.core.api.Assertions.assertThat(chatService.getConversationDetail(bob.getUsername(), id).limitedMessagesRemaining()).isEqualTo(5);
        for (int index = 0; index < 5; index++) chatService.sendMessageFromWebSocket(bob.getUsername(), id, "Bob " + index);
        org.assertj.core.api.Assertions.assertThat(messageRepository.countByConversationId(id)).isEqualTo(10);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> chatService.sendMessage(bob.getUsername(), id, new SendMessageRequest("Bob sixth")))
                .isInstanceOf(IllegalArgumentException.class);
        markFriends(alice, bob);
        org.assertj.core.api.Assertions.assertThat(chatService.getConversationDetail(alice.getUsername(), id).limitedMessagesRemaining()).isNull();
        chatService.sendMessage(bob.getUsername(), id, new SendMessageRequest("Now friends"));
        org.assertj.core.api.Assertions.assertThat(messageRepository.countByConversationId(id)).isEqualTo(11);
        org.assertj.core.api.Assertions.assertThat(conversationRepository.findById(id).orElseThrow().isContextualLimited()).isFalse();
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

        private UserLocation buildLocation(Long userId, Double latitude, Double longitude) {
                UserLocation location = new UserLocation();
                location.setUserId(userId);
                location.setLatitude(latitude);
                location.setLongitude(longitude);
                location.setUpdatedAt(Instant.now());
                return location;
        }
}
