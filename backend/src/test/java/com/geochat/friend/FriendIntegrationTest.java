package com.geochat.friend;

import com.geochat.auth.security.JwtService;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
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
class FriendIntegrationTest {

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
    void sendFriendRequestAndListPendingRequests() throws Exception {
        User sender = createUser("friend-sender");
        User receiver = createUser("friend-receiver");
        String senderToken = tokenFor(sender);

        mockMvc.perform(post("/api/v1/friends/requests")
                        .header("Authorization", bearer(senderToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + receiver.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(FriendRequestStatus.PENDING.name()));

        mockMvc.perform(get("/api/v1/friends/requests/incoming")
                        .header("Authorization", bearer(tokenFor(receiver))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].user.userId").value(sender.getId()))
                .andExpect(jsonPath("$.data.items[0].user.username").value(sender.getUsername()));

        mockMvc.perform(get("/api/v1/friends/requests/outgoing")
                        .header("Authorization", bearer(senderToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].user.userId").value(receiver.getId()))
                .andExpect(jsonPath("$.data.items[0].user.username").value(receiver.getUsername()));
    }

    @Test
    void acceptRejectAndCancelRequest() throws Exception {
        User acceptSender = createUser("friend-accept-sender");
        User acceptReceiver = createUser("friend-accept-receiver");
        String acceptRequestId = createRequest(acceptSender, acceptReceiver);

        mockMvc.perform(post("/api/v1/friends/requests/" + acceptRequestId + "/accept")
                        .header("Authorization", bearer(tokenFor(acceptReceiver))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(FriendRequestStatus.ACCEPTED.name()));

        User rejectSender = createUser("friend-reject-sender");
        User rejectReceiver = createUser("friend-reject-receiver");
        String rejectRequestId = createRequest(rejectSender, rejectReceiver);

        mockMvc.perform(post("/api/v1/friends/requests/" + rejectRequestId + "/reject")
                        .header("Authorization", bearer(tokenFor(rejectReceiver))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(FriendRequestStatus.REJECTED.name()));

        User cancelSender = createUser("friend-cancel-sender");
        User cancelReceiver = createUser("friend-cancel-receiver");
        String cancelRequestId = createRequest(cancelSender, cancelReceiver);

        mockMvc.perform(post("/api/v1/friends/requests/" + cancelRequestId + "/cancel")
                        .header("Authorization", bearer(tokenFor(cancelSender))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(FriendRequestStatus.CANCELLED.name()));
    }

    @Test
    void onlyTheRequestParticipantsCanModifyAFriendRequest() throws Exception {
        User sender = createUser("friend-auth-sender");
        User receiver = createUser("friend-auth-receiver");
        User otherUser = createUser("friend-auth-other");
        String requestId = createRequest(sender, receiver);

        mockMvc.perform(post("/api/v1/friends/requests/" + requestId + "/accept")
                        .header("Authorization", bearer(tokenFor(sender))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/friends/requests/" + requestId + "/accept")
                        .header("Authorization", bearer(tokenFor(otherUser))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/friends/requests/" + requestId + "/cancel")
                        .header("Authorization", bearer(tokenFor(receiver))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/friends/requests/" + requestId + "/accept")
                        .header("Authorization", bearer(tokenFor(receiver))))
                .andExpect(status().isOk());
    }

    @Test
    void rejectedFriendRequestCanBeSentAndRejectedAgain() throws Exception {
        User sender = createUser("friend-repeat-sender");
        User receiver = createUser("friend-repeat-receiver");
        String firstRequestId = createRequest(sender, receiver);

        mockMvc.perform(post("/api/v1/friends/requests/" + firstRequestId + "/reject")
                        .header("Authorization", bearer(tokenFor(receiver))))
                .andExpect(status().isOk());

        String secondRequestId = createRequest(sender, receiver);
        mockMvc.perform(post("/api/v1/friends/requests/" + secondRequestId + "/reject")
                        .header("Authorization", bearer(tokenFor(receiver))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(FriendRequestStatus.REJECTED.name()));
    }

    @Test
    void friendListExcludesPendingAndSelf() throws Exception {
        User userA = createUser("friend-a");
        User userB = createUser("friend-b");
        User userC = createUser("friend-c");

        String requestId = createRequest(userA, userB);
        mockMvc.perform(post("/api/v1/friends/requests/" + requestId + "/accept")
                        .header("Authorization", bearer(tokenFor(userB))))
                .andExpect(status().isOk());

        createRequest(userA, userC);

        mockMvc.perform(get("/api/v1/friends").header("Authorization", bearer(tokenFor(userA))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].userId").value(userB.getId()))
                .andExpect(jsonPath("$.data.items[0].username").value(userB.getUsername()));
    }

    @Test
    void invalidFriendRequestIsRejected() throws Exception {
        User userA = createUser("friend-invalid-a");
        User userB = createUser("friend-invalid-b");

        mockMvc.perform(post("/api/v1/friends/requests")
                        .header("Authorization", bearer(tokenFor(userA)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + userA.getId() + "}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/friends/requests")
                        .header("Authorization", bearer(tokenFor(userA)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + userB.getId() + "}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/friends/requests")
                        .header("Authorization", bearer(tokenFor(userA)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + userB.getId() + "}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/friends/requests/incoming")
                        .header("Authorization", bearer(tokenFor(userA))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(0));
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mockMvc.perform(post("/api/v1/friends/requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":1}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/friends"))
                .andExpect(status().isUnauthorized());
    }

    private String createRequest(User sender, User receiver) throws Exception {
        String response = mockMvc.perform(post("/api/v1/friends/requests")
                        .header("Authorization", bearer(tokenFor(sender)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + receiver.getId() + "}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        int requestIdIndex = response.indexOf("\"requestId\":");
        String requestIdText = response.substring(requestIdIndex + 12);
        int end = requestIdText.indexOf(',');
        if (end == -1) {
            end = requestIdText.indexOf('}');
        }
        return requestIdText.substring(0, end).replaceAll("\\D+", "");
    }

    private User createUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode("FriendTest123!"));
        user.setDisplayName(username);
        user.setStatus(UserStatus.ACTIVE);
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
}
