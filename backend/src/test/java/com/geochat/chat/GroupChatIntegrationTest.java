package com.geochat.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geochat.auth.security.JwtService;
import com.geochat.chat.repository.ConversationParticipantRepository;
import com.geochat.chat.repository.ConversationRepository;
import com.geochat.chat.repository.MessageRepository;
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
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.chat.max-group-members=3",
        "spring.datasource.url=jdbc:h2:mem:geochat_group_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
})
@ActiveProfiles("test")
class GroupChatIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FriendRequestRepository friendRequestRepository;
    @Autowired
    private ConversationRepository conversationRepository;
    @Autowired
    private ConversationParticipantRepository participantRepository;
    @Autowired
    private MessageRepository messageRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JwtService jwtService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(webApplicationContext.getBean(FilterChainProxy.class))
                .build();
        messageRepository.deleteAll();
        participantRepository.deleteAll();
        conversationRepository.deleteAll();
        friendRequestRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void createsGroupWithOwnerAndDeduplicatedFriendMembers() throws Exception {
        User owner = createUser("group-owner", "Owner");
        User member = createUser("group-member", "Member");
        markFriends(owner, member);

        String response = mockMvc.perform(post("/api/v1/groups")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groupBody("  Weekend chat  ", List.of(owner.getId(), member.getId(), member.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Weekend chat"))
                .andExpect(jsonPath("$.data.owner.userId").value(owner.getId()))
                .andExpect(jsonPath("$.data.memberCount").value(2))
                .andReturn().getResponse().getContentAsString();
        long groupId = objectMapper.readTree(response).path("data").path("groupId").asLong();

        mockMvc.perform(get("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[?(@.role == 'OWNER')]" ).isArray())
                .andExpect(jsonPath("$.data.items[?(@.role == 'MEMBER')]" ).isArray());
    }

    @Test
    void memberCanViewGroupAndMembersButNonMemberCannot() throws Exception {
        User owner = createUser("group-view-owner", "Owner");
        User member = createUser("group-view-member", "Member");
        User outsider = createUser("group-view-outsider", "Outsider");
        markFriends(owner, member);
        long groupId = createGroup(owner, List.of(member.getId()));

        mockMvc.perform(get("/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberCount").value(2));
        mockMvc.perform(get("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2));
        mockMvc.perform(get("/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyOwnerCanRenameGroupAndNameIsTrimmedAndValidated() throws Exception {
        User owner = createUser("group-rename-owner", "Owner");
        User member = createUser("group-rename-member", "Member");
        markFriends(owner, member);
        long groupId = createGroup(owner, List.of(member.getId()));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                                "/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  New name  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("New name"));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                                "/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Not allowed\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                                "/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                                "/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + "x".repeat(101) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidMembersNamesAndGroupSizeAreRejectedWithoutCreatingConversation() throws Exception {
        User owner = createUser("group-rules-owner", "Owner");
        User friend = createUser("group-rules-friend", "Friend");
        User nonFriend = createUser("group-rules-nonfriend", "Nonfriend");
        User anotherFriend = createUser("group-rules-another", "Another");
        markFriends(owner, friend);
        markFriends(owner, anotherFriend);
        String auth = bearer(owner);

        mockMvc.perform(post("/api/v1/groups").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(groupBody(" ", List.of())))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/groups").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(groupBody("x".repeat(101), List.of())))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/groups").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(groupBody("No", List.of(nonFriend.getId()))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/groups").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(groupBody("Missing", List.of(999999L))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/groups").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groupBody("Too many", List.of(friend.getId(), anotherFriend.getId(), nonFriend.getId()))))
                .andExpect(status().isBadRequest());

        assertThat(conversationRepository.findAll()).isEmpty();
    }

    @Test
    void groupMembersCanSendAndReadMessagesButOutsiderCannot() throws Exception {
        User owner = createUser("group-msg-owner", "Owner");
        User member = createUser("group-msg-member", "Member");
        User outsider = createUser("group-msg-outsider", "Outsider");
        markFriends(owner, member);
        long groupId = createGroup(owner, List.of(member.getId()));

        mockMvc.perform(post("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Hello group\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("Hello group"));
        mockMvc.perform(get("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].content").value("Hello group"));
        mockMvc.perform(post("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(outsider)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"No access\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void memberCanLeaveButOwnerAndNonMemberCannot() throws Exception {
        User owner = createUser("group-leave-owner", "Owner");
        User member = createUser("group-leave-member", "Member");
        User outsider = createUser("group-leave-outsider", "Outsider");
        markFriends(owner, member);
        long groupId = createGroup(owner, List.of(member.getId()));

        mockMvc.perform(delete("/api/v1/groups/{groupId}/members/me", groupId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/api/v1/groups/{groupId}/members/me", groupId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/groups/{groupId}/members/me", groupId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"After leaving\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownerCanAddMembersRepeatedlyAndRemoveThemButMembersCannot() throws Exception {
        User owner = createUser("group-admin-owner", "Owner");
        User first = createUser("group-admin-first", "First");
        User second = createUser("group-admin-second", "Second");
        User nonFriend = createUser("group-admin-nonfriend", "Nonfriend");
        markFriends(owner, first);
        markFriends(owner, second);
        long groupId = createGroup(owner, List.of());

        mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(memberBody(List.of(first.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberCount").value(2));
        mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(memberBody(List.of(second.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberCount").value(3));

        mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(memberBody(List.of(first.getId()))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(memberBody(List.of(nonFriend.getId()))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON)
                        .content(memberBody(List.of(nonFriend.getId()))))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/groups/{groupId}/members/{memberId}", groupId, second.getId())
                        .header("Authorization", bearer(first)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/groups/{groupId}/members/{memberId}", groupId, owner.getId())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(delete("/api/v1/groups/{groupId}/members/{memberId}", groupId, second.getId())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberCount").value(2));
        mockMvc.perform(get("/api/v1/groups/{groupId}", groupId)
                        .header("Authorization", bearer(second)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(second)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(second)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"After removal\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/groups/{groupId}/members/{memberId}", groupId, second.getId())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void addingMembersRespectsTheMaximumGroupSize() throws Exception {
        User owner = createUser("group-cap-owner", "Owner");
        User first = createUser("group-cap-first", "First");
        User second = createUser("group-cap-second", "Second");
        User third = createUser("group-cap-third", "Third");
        markFriends(owner, first);
        markFriends(owner, second);
        markFriends(owner, third);
        long groupId = createGroup(owner, List.of(first.getId()));

        mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(memberBody(List.of(second.getId(), third.getId()))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(memberBody(List.of(second.getId()))))
                .andExpect(status().isOk());
    }

        @Test
        void concurrentMemberAdditionsRespectTheMaximumGroupSize() throws Exception {
                User owner = createUser("group-race-owner", "Owner");
                User existing = createUser("group-race-existing", "Existing");
                User first = createUser("group-race-first", "First");
                User second = createUser("group-race-second", "Second");
                markFriends(owner, existing);
                markFriends(owner, first);
                markFriends(owner, second);
                long groupId = createGroup(owner, List.of(existing.getId()));
                CountDownLatch ready = new CountDownLatch(2);
                CountDownLatch start = new CountDownLatch(1);
                ExecutorService executor = Executors.newFixedThreadPool(2);

                try {
                        Future<Integer> firstResult = executor.submit(() -> addMemberConcurrently(owner, groupId, first, ready, start));
                        Future<Integer> secondResult = executor.submit(() -> addMemberConcurrently(owner, groupId, second, ready, start));
                        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
                        start.countDown();

                        assertThat(List.of(firstResult.get(10, TimeUnit.SECONDS), secondResult.get(10, TimeUnit.SECONDS)))
                                        .containsExactlyInAnyOrder(200, 400);
                        assertThat(participantRepository.countByConversationId(groupId)).isEqualTo(3);
                } finally {
                        executor.shutdownNow();
                }
        }

        private int addMemberConcurrently(User owner, long groupId, User member,
                                                                          CountDownLatch ready, CountDownLatch start) throws Exception {
                ready.countDown();
                start.await();
                return mockMvc.perform(post("/api/v1/groups/{groupId}/members", groupId)
                                                .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                                                .content(memberBody(List.of(member.getId()))))
                                .andReturn().getResponse().getStatus();
        }

    @Test
    void ownerOnlyGroupIsListedAndOnlyTheOwnerCanDeleteItWithItsMessagesAndMembers() throws Exception {
        User owner = createUser("group-delete-owner", "Owner");
        User member = createUser("group-delete-member", "Member");
        markFriends(owner, member);
        long emptyGroupId = createGroup(owner, List.of());
        mockMvc.perform(get("/api/v1/chats").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].conversationId").value(emptyGroupId));
        long groupId = createGroup(owner, List.of(member.getId()));
        mockMvc.perform(post("/api/v1/chats/{groupId}/messages", groupId)
                        .header("Authorization", bearer(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"bye\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/groups/{groupId}", groupId).header("Authorization", bearer(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/groups/{groupId}", groupId).header("Authorization", bearer(owner)))
                .andExpect(status().isOk());

        assertThat(conversationRepository.existsById(groupId)).isFalse();
        assertThat(participantRepository.countByConversationId(groupId)).isZero();
        assertThat(messageRepository.countByConversationId(groupId)).isZero();
        mockMvc.perform(get("/api/v1/groups/{groupId}", groupId).header("Authorization", bearer(member)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/groups/{groupId}", groupId).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    private String memberBody(List<Long> memberIds) throws Exception {
        return objectMapper.writeValueAsString(java.util.Map.of("memberIds", memberIds));
    }

    private long createGroup(User owner, List<Long> memberIds) throws Exception {
        String response = mockMvc.perform(post("/api/v1/groups")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(groupBody("Test group", memberIds)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(response);
        return json.path("data").path("groupId").asLong();
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

    private String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user.getId(), user.getUsername());
    }

    private String groupBody(String name, List<Long> memberIds) throws Exception {
        return objectMapper.writeValueAsString(new GroupBody(name, memberIds));
    }

    private record GroupBody(String name, List<Long> memberIds) {
    }
}