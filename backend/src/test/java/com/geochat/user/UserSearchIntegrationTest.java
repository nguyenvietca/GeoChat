package com.geochat.user;

import com.geochat.auth.security.JwtService;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class UserSearchIntegrationTest {

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
    void searchesUsersByUsernameAndDisplayNameAndExcludesCurrentUser() throws Exception {
        User currentUser = createUser("nguyen", "Nguyen Van A");
        createUser("nguyenvana", "Nguyen B");
        createUser("alice", "Alice Example");

        mockMvc.perform(get("/api/v1/users/search")
                        .header("Authorization", bearer(tokenFor(currentUser)))
                        .param("q", "nguyen"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].userId").value(org.hamcrest.Matchers.not(currentUser.getId())))
                .andExpect(jsonPath("$.data.items[0].username").value("nguyenvana"))
                .andExpect(jsonPath("$.data.items[0].displayName").value("Nguyen B"))
                .andExpect(jsonPath("$.data.items[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].password").doesNotExist());
    }

    @Test
    void searchQueryValidationRejectsBlankShortAndOverlongValues() throws Exception {
        User currentUser = createUser("search-validator", "Search Validator");

        mockMvc.perform(get("/api/v1/users/search")
                        .header("Authorization", bearer(tokenFor(currentUser)))
                        .param("q", " "))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/users/search")
                        .header("Authorization", bearer(tokenFor(currentUser)))
                        .param("q", "a"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/users/search")
                        .header("Authorization", bearer(tokenFor(currentUser)))
                        .param("q", "x".repeat(101)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/users/search"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void searchIncludesRelationshipStatusForFriendRequests() throws Exception {
        User currentUser = createUser("current-user", "Current User");
        User friendCandidate = createUser("friend-candidate", "Friend Candidate");

        FriendRequest request = new FriendRequest();
        request.setSenderId(currentUser.getId());
        request.setReceiverId(friendCandidate.getId());
        request.setStatus(FriendRequestStatus.PENDING);
        request.setCreatedAt(Instant.now());
        request.setUpdatedAt(Instant.now());
        friendRequestRepository.save(request);

        mockMvc.perform(get("/api/v1/users/search")
                        .header("Authorization", bearer(tokenFor(currentUser)))
                        .param("q", "friend"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].relationship").value("PENDING_OUTGOING"));
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
}
