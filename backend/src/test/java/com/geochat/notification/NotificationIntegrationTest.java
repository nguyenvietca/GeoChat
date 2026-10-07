package com.geochat.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.context.WebApplicationContext;

import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.OpenDirectChatRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.notification.repository.NotificationRepository;
import com.geochat.notification.repository.UserPushDeviceRepository;
import com.geochat.notification.dto.NotificationResponse;
import com.geochat.notification.entity.Notification;
import com.geochat.notification.entity.UserPushDevice;
import com.geochat.notification.enumtype.NotificationReferenceType;
import com.geochat.notification.enumtype.NotificationType;
import com.geochat.notification.service.ExpoPushGateway;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;

@SpringBootTest(properties = "push-notifications.enabled=true")
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
	private UserPushDeviceRepository pushDeviceRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private ChatService chatService;

	@MockitoBean
	private ExpoPushGateway expoPushGateway;

	@MockitoBean
	private SimpMessagingTemplate messagingTemplate;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(webApplicationContext.getBean(FilterChainProxy.class)).build();
		notificationRepository.deleteAll();
		pushDeviceRepository.deleteAll();
		friendRequestRepository.deleteAll();
		userRepository.deleteAll();
	}

	@Test
	void pushDeviceRegistrationIsAuthenticatedIdempotentAndOwnerScoped() throws Exception {
		User alice = createUser("alice-device");
		User bob = createUser("bob-device");
		String body = "{\"token\":\"ExponentPushToken[device-token]\",\"platform\":\"android\"}";

		mockMvc.perform(post("/api/v1/notifications/devices").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isUnauthorized());

		String firstResponse = mockMvc.perform(post("/api/v1/notifications/devices")
				.header("Authorization", bearer(tokenFor(alice))).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.platform").value("android"))
				.andExpect(jsonPath("$.data.token").doesNotExist()).andReturn().getResponse().getContentAsString();
		Long deviceId = extractDeviceId(firstResponse);

		mockMvc.perform(post("/api/v1/notifications/devices")
				.header("Authorization", bearer(tokenFor(alice))).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.deviceId").value(deviceId));
		org.junit.jupiter.api.Assertions.assertEquals(1, pushDeviceRepository.count());

		mockMvc.perform(post("/api/v1/notifications/devices")
				.header("Authorization", bearer(tokenFor(bob))).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isForbidden());

		mockMvc.perform(delete("/api/v1/notifications/devices/" + deviceId)
				.header("Authorization", bearer(tokenFor(bob))))
				.andExpect(status().isNotFound());

		mockMvc.perform(delete("/api/v1/notifications/devices/" + deviceId)
				.header("Authorization", bearer(tokenFor(alice))))
				.andExpect(status().isOk());
		org.junit.jupiter.api.Assertions.assertFalse(pushDeviceRepository.findById(deviceId).orElseThrow().isActive());
	}

	@Test
	void friendRequestAndAcceptanceCreateNotifications() throws Exception {
		User alice = createUser("alice-notify");
		User bob = createUser("bob-notify");
		savePushDevice(alice, "ExponentPushToken[alice-notify]");
		savePushDevice(bob, "ExponentPushToken[bob-notify]");

		String requestResponse = mockMvc
				.perform(post("/api/v1/friends/requests").header("Authorization", bearer(tokenFor(alice)))
						.contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + bob.getId() + "}"))
				.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

		Long requestId = extractRequestId(requestResponse);
		verify(expoPushGateway).send(eq("ExponentPushToken[bob-notify]"), eq("Friend request"), anyString(),
				argThat(data -> "FRIEND_REQUEST_RECEIVED".equals(data.get("type"))
						&& requestId.equals(data.get("friendRequestId"))));

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
		verify(expoPushGateway).send(eq("ExponentPushToken[alice-notify]"), eq("Friend request accepted"), anyString(),
				argThat(data -> "FRIEND_REQUEST_ACCEPTED".equals(data.get("type"))
						&& requestId.equals(data.get("friendRequestId"))));

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
		savePushDevice(bob, "ExponentPushToken[bob-message]");

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
		verify(expoPushGateway).send(eq("ExponentPushToken[bob-message]"), eq("New message"), anyString(),
				argThat(data -> "NEW_MESSAGE".equals(data.get("type"))
						&& conversationId.equals(data.get("conversationId"))));
		verify(messagingTemplate).convertAndSendToUser(eq(bob.getUsername()), eq("/queue/notifications"),
				argThat(payload -> payload instanceof NotificationResponse notification
						&& "NEW_MESSAGE".equals(notification.type().name())
						&& conversationId.equals(notification.conversationId())));

		mockMvc.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(bob))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
				.andExpect(jsonPath("$.data.items[0].type").value("NEW_MESSAGE"))
				.andExpect(jsonPath("$.data.items[0].conversationId").value(conversationId));

		mockMvc.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(alice))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(0));
	}

	@Test
	void notificationListSupportsBoundedOffsetPagination() throws Exception {
		User recipient = createUser("paged-notifications");
		for (int index = 0; index < 21; index++) {
			Notification notification = new Notification();
			notification.setRecipientId(recipient.getId());
			notification.setType(NotificationType.FRIEND_REQUEST_RECEIVED);
			notification.setTitle("Friend request");
			notification.setMessage("A friend request arrived.");
			notification.setReferenceType(NotificationReferenceType.FRIEND_REQUEST);
			notification.setReferenceId((long) index + 1);
			notification.setCreatedAt(Instant.parse("2026-10-01T00:00:00Z").plusSeconds(index));
			notificationRepository.save(notification);
		}

		mockMvc.perform(get("/api/v1/notifications?limit=20&offset=0")
				.header("Authorization", bearer(tokenFor(recipient))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.items.length()").value(20))
				.andExpect(jsonPath("$.data.total").value(21))
				.andExpect(jsonPath("$.data.hasMore").value(true));

		mockMvc.perform(get("/api/v1/notifications?limit=20&offset=20")
				.header("Authorization", bearer(tokenFor(recipient))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.items.length()").value(1))
				.andExpect(jsonPath("$.data.hasMore").value(false));
	}

	@Test
	void providerFailureDoesNotFailFriendRequestOrNotificationCreation() throws Exception {
		User alice = createUser("alice-push-failure");
		User bob = createUser("bob-push-failure");
		savePushDevice(bob, "ExponentPushToken[bob-push-failure]");
		doThrow(new IllegalStateException("Expo unavailable"))
				.when(expoPushGateway).send(anyString(), anyString(), anyString(), anyMap());

		mockMvc.perform(post("/api/v1/friends/requests").header("Authorization", bearer(tokenFor(alice)))
				.contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + bob.getId() + "}"))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/notifications").header("Authorization", bearer(tokenFor(bob))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1));
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

	private void savePushDevice(User user, String pushToken) {
		UserPushDevice device = new UserPushDevice();
		device.setUserId(user.getId());
		device.setPushToken(pushToken);
		device.setPlatform("ios");
		pushDeviceRepository.save(device);
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

	private Long extractDeviceId(String response) {
		int index = response.indexOf("\"deviceId\":");
		String payload = response.substring(index + 11);
		int end = payload.indexOf(',');
		if (end == -1) {
			end = payload.indexOf('}');
		}
		return Long.parseLong(payload.substring(0, end));
	}
}
