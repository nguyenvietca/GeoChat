package com.geochat.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

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

import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.OpenDirectChatRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.notification.repository.NotificationRepository;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;

@SpringBootTest
@ActiveProfiles("test")
class NotificationIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private FriendRequestRepository friendRequestRepository;

	@Autowired
	private NotificationRepository notificationRepository;

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
				.addFilters(webApplicationContext.getBean(FilterChainProxy.class)).build();
		notificationRepository.deleteAll();
		friendRequestRepository.deleteAll();
		userRepository.deleteAll();
	}

	@Test
	void friendRequestAndAcceptanceCreateNotifications() throws Exception {
		User alice = createUser("alice-notify");
		User bob = createUser("bob-notify");

		String requestResponse = mockMvc
				.perform(post("/api/v1/friends/requests").header("Authorization", bearer(tokenFor(alice)))
						.contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + bob.getId() + "}"))
				.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

		Long requestId = extractRequestId(requestResponse);

		mockMvc.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(bob))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
				.andExpect(jsonPath("$.data.items[0].type").value("FRIEND_REQUEST_RECEIVED"));

		mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", bearer(tokenFor(bob))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.unreadCount").value(1));

		String notificationId = mockMvc
				.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(bob)))).andReturn()
				.getResponse().getContentAsString();
		Long bobNotificationId = extractNotificationId(notificationId);

		mockMvc.perform(post("/api/v1/notifications/" + bobNotificationId + "/read").header("Authorization",
				bearer(tokenFor(bob)))).andExpect(status().isOk()).andExpect(jsonPath("$.data.read").value(true));

		mockMvc.perform(post("/api/v1/friends/requests/" + requestId + "/accept").header("Authorization",
				bearer(tokenFor(bob)))).andExpect(status().isOk())
				.andExpect(jsonPath("$.data.status").value(FriendRequestStatus.ACCEPTED.name()));

		mockMvc.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(alice))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
				.andExpect(jsonPath("$.data.items[0].type").value("FRIEND_REQUEST_ACCEPTED"));

		mockMvc.perform(post("/api/v1/notifications/read-all").header("Authorization", bearer(tokenFor(alice))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.unreadCount").value(0));
	}

	@Test
	void messageCreationCreatesNotificationOnlyForOtherParticipant() throws Exception {
		User alice = createUser("alice-msg");
		User bob = createUser("bob-msg");

		FriendRequest acceptedRequest = new FriendRequest();
		acceptedRequest.setSenderId(alice.getId());
		acceptedRequest.setReceiverId(bob.getId());
		acceptedRequest.setStatus(FriendRequestStatus.ACCEPTED);
		acceptedRequest.setCreatedAt(Instant.now());
		acceptedRequest.setUpdatedAt(Instant.now());
		friendRequestRepository.save(acceptedRequest);

		Long conversationId = chatService
				.openDirectConversation(alice.getUsername(), new OpenDirectChatRequest(bob.getId())).conversationId();
		chatService.sendMessage(alice.getUsername(), conversationId, new SendMessageRequest("hello"));

		mockMvc.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(bob))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
				.andExpect(jsonPath("$.data.items[0].type").value("NEW_MESSAGE"));

		mockMvc.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(alice))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(0));
	}

	private User createUser(String username) {
		User user = new User();
		user.setUsername(username);
		user.setPasswordHash(passwordEncoder.encode("Password123!"));
		user.setDisplayName(username.toUpperCase());
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

	private Long extractRequestId(String response) {
		int index = response.indexOf("\"requestId\":");
		String payload = response.substring(index + 12);
		int end = payload.indexOf(',');
		if (end == -1) {
			end = payload.indexOf('}');
		}
		return Long.parseLong(payload.substring(0, end));
	}

	private Long extractNotificationId(String response) {
		int index = response.indexOf("\"id\":");
		String payload = response.substring(index + 5);
		int end = payload.indexOf(',');
		if (end == -1) {
			end = payload.indexOf('}');
		}
		return Long.parseLong(payload.substring(0, end));
	}
}
