package com.geochat.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.OpenDirectChatRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.dto.CreateGroupRequest;
import com.geochat.chat.repository.ConversationRepository;
import com.geochat.chat.service.ChatService;
import com.geochat.chat.service.GroupService;
import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import com.geochat.friend.repository.FriendRequestRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ChatWebSocketIntegrationTest {

	@LocalServerPort
	private int port;

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

	@Autowired
	private GroupService groupService;

	@Autowired
	private ConversationRepository conversationRepository;

	@Autowired
	private SimpUserRegistry simpUserRegistry;

	@Value("${jwt.secret}")
	private String jwtSecret;

	private final ObjectMapper objectMapper = new ObjectMapper();

	@BeforeEach
	void setUp() {
		conversationRepository.deleteAll();
		friendRequestRepository.deleteAll();
		userRepository.deleteAll();
	}

	@Test
	void groupMembersReceiveRealtimeMessagesAndNonMembersCannotSubscribeOrSend() throws Exception {
		User owner = createUser("owner-group-ws", "Owner");
		User member = createUser("member-group-ws", "Member");
		User outsider = createUser("outsider-group-ws", "Outsider");
		markFriends(owner, member);
		Long groupId = groupService.createGroup(owner.getUsername(),
				new CreateGroupRequest("Realtime group", java.util.List.of(member.getId()))).groupId();

		StompSession ownerSession = connectSession(tokenFor(owner));
		StompSession memberSession = connectSession(tokenFor(member));
		StompSession outsiderSession = connectSession(tokenFor(outsider));
		BlockingQueue<Map<String, Object>> ownerQueue = new LinkedBlockingQueue<>();
		BlockingQueue<Map<String, Object>> memberQueue = new LinkedBlockingQueue<>();
		BlockingQueue<Map<String, Object>> outsiderQueue = new LinkedBlockingQueue<>();

		ownerSession.subscribe("/topic/chat/" + groupId, frameHandler(ownerQueue));
		memberSession.subscribe("/topic/chat/" + groupId, frameHandler(memberQueue));
		outsiderSession.subscribe("/topic/chat/" + groupId, frameHandler(outsiderQueue));
		ownerSession.send("/app/chat/" + groupId + "/send", Map.of("content", "Group broadcast"));

		assertThat(ownerQueue.poll(10, TimeUnit.SECONDS).get("content")).isEqualTo("Group broadcast");
		assertThat(memberQueue.poll(10, TimeUnit.SECONDS).get("content")).isEqualTo("Group broadcast");
		assertThat(outsiderQueue.poll(1, TimeUnit.SECONDS)).isNull();

		StompSession outsiderSendSession = connectSession(tokenFor(outsider));
		outsiderSendSession.send("/app/chat/" + groupId + "/send", Map.of("content", "Forbidden"));
		assertThat(chatService.listMessages(owner.getUsername(), groupId, 50).total()).isEqualTo(1);
		assertThat(memberQueue.poll(1, TimeUnit.SECONDS)).isNull();
	}

	@Test
	void directConversationPresenceChangesToOfflineAfterTheLastSessionDisconnects() throws Exception {
		User alice = createUser("presence-alice-ws", "Alice");
		User bob = createUser("presence-bob-ws", "Bob");
		markFriends(alice, bob);
		Long conversationId = openConversation(alice, bob);

		StompSession bobSession = connectSession(tokenFor(bob));
		BlockingQueue<Map<String, Object>> presenceEvents = new LinkedBlockingQueue<>();
		bobSession.subscribe("/topic/presence/" + alice.getId(), frameHandler(presenceEvents));
		StompSession aliceSession = connectSession(tokenFor(alice));

		Map<String, Object> onlineEvent = presenceEvents.poll(10, TimeUnit.SECONDS);
		assertThat(onlineEvent).containsEntry("userId", alice.getId().intValue()).containsEntry("online", true);
		HttpRequest presenceRequest = HttpRequest.newBuilder()
				.uri(URI.create("http://localhost:" + port + "/api/v1/chats/" + conversationId + "/presence"))
				.header("Authorization", "Bearer " + tokenFor(bob)).GET().build();
		HttpResponse<String> onlineSnapshot = HttpClient.newHttpClient()
				.send(presenceRequest, HttpResponse.BodyHandlers.ofString());
		assertThat(onlineSnapshot.statusCode()).isEqualTo(200);
		assertThat(objectMapper.readTree(onlineSnapshot.body()).path("data").path("items").findValue("userId"))
				.isNotNull();
		assertThat(objectMapper.readTree(onlineSnapshot.body()).path("data").path("items").findValuesAsText("online"))
				.contains("true");

		aliceSession.disconnect();
		Map<String, Object> offlineEvent = presenceEvents.poll(10, TimeUnit.SECONDS);
		assertThat(offlineEvent).containsEntry("userId", alice.getId().intValue()).containsEntry("online", false);

		HttpResponse<String> offlineSnapshot = HttpClient.newHttpClient()
				.send(presenceRequest, HttpResponse.BodyHandlers.ofString());
		assertThat(objectMapper.readTree(offlineSnapshot.body()).path("data").path("items").findValuesAsText("online"))
				.contains("false");
	}

	@Test
	void removedMemberReceivesRemovalEventButNoFurtherGroupMessages() throws Exception {
		User owner = createUser("owner-group-revoke-ws", "Owner");
		User member = createUser("member-group-revoke-ws", "Member");
		markFriends(owner, member);
		Long groupId = groupService.createGroup(owner.getUsername(),
				new CreateGroupRequest("Revoked group", java.util.List.of(member.getId()))).groupId();

		StompSession ownerSession = connectSession(tokenFor(owner));
		StompSession memberSession = connectSession(tokenFor(member));
		BlockingQueue<Map<String, Object>> ownerMessages = new LinkedBlockingQueue<>();
		BlockingQueue<Map<String, Object>> memberMessages = new LinkedBlockingQueue<>();
		BlockingQueue<Map<String, Object>> memberEvents = new LinkedBlockingQueue<>();
		ownerSession.subscribe("/topic/chat/" + groupId, frameHandler(ownerMessages));
		memberSession.subscribe("/topic/chat/" + groupId, frameHandler(memberMessages));
		memberSession.subscribe("/user/queue/group-events", frameHandler(memberEvents));

		groupService.removeMember(owner.getUsername(), groupId, member.getId());

		Map<String, Object> removalEvent = memberEvents.poll(10, TimeUnit.SECONDS);
		assertThat(removalEvent).isNotNull();
		assertThat(removalEvent.get("type")).isEqualTo("MEMBER_REMOVED");
		assertThat(((Map<?, ?>) removalEvent.get("member")).get("user").toString()).contains("userId");
		ownerSession.send("/app/chat/" + groupId + "/send", Map.of("content", "After removal"));

		assertThat(ownerMessages.poll(10, TimeUnit.SECONDS).get("content")).isEqualTo("After removal");
		assertThat(memberMessages.poll(1, TimeUnit.SECONDS)).isNull();
		assertThat(memberEvents.poll(1, TimeUnit.SECONDS)).isNull();
	}

	@Test
	void validJwtCanConnectAndReceiveRealtimeMessage() throws Exception {
		User alice = createUser("alice-ws", "Alice");
		User bob = createUser("bob-ws", "Bob");
		markFriends(alice, bob);

		Long conversationId = openConversation(alice, bob);

		StompSession aliceSession = connectSession(tokenFor(alice));
		StompSession bobSession = connectSession(tokenFor(bob));

		BlockingQueue<Map<String, Object>> aliceQueue = new LinkedBlockingQueue<>();
		BlockingQueue<Map<String, Object>> bobQueue = new LinkedBlockingQueue<>();

		aliceSession.subscribe("/topic/chat/" + conversationId, new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				aliceQueue.add((Map<String, Object>) payload);
			}
		});

		bobSession.subscribe("/topic/chat/" + conversationId, new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				bobQueue.add((Map<String, Object>) payload);
			}
		});

		aliceSession.send("/app/chat/" + conversationId + "/send", Map.of("content", "Hello from Alice"));

		Map<String, Object> aliceMessage = aliceQueue.poll(10, TimeUnit.SECONDS);
		Map<String, Object> bobMessage = bobQueue.poll(10, TimeUnit.SECONDS);

		assertThat(aliceMessage).isNotNull();
		assertThat(aliceMessage.get("content")).isEqualTo("Hello from Alice");
		assertThat(aliceMessage.get("senderId")).isEqualTo(alice.getId().intValue());
		assertThat(bobMessage).isNotNull();
		assertThat(bobMessage.get("content")).isEqualTo("Hello from Alice");
		assertThat(bobMessage.get("senderId")).isEqualTo(alice.getId().intValue());
	}

	@Test
	void invalidJwtIsRejected() {
		assertThatThrownBy(() -> connectSession("bad-token")).isInstanceOf(Exception.class);
	}

	@Test
	void validJwtForDeletedUserIsRejected() {
		User alice = createUser("alice-deleted-ws", "Alice");
		String token = tokenFor(alice);
		userRepository.delete(alice);

		assertThatThrownBy(() -> connectSession(token)).isInstanceOf(Exception.class);
	}

	@Test
	void websocketConnectionClosesWhenJwtExpires() throws Exception {
		User alice = createUser("alice-expiring-ws", "Alice");
		String shortLivedToken = new JwtService(jwtSecret, 5000).generateToken(alice.getId(), alice.getUsername());
		StompSession session = connectSession(shortLivedToken);

		long deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(10);
		while (session.isConnected() && System.currentTimeMillis() < deadline) {
			Thread.sleep(50);
		}

		assertThat(session.isConnected()).isFalse();
	}

	@Test
	void restSentMessageIsBroadcastToConversationSubscribers() throws Exception {
		User alice = createUser("alice-rest-ws", "Alice");
		User bob = createUser("bob-rest-ws", "Bob");
		markFriends(alice, bob);
		Long conversationId = openConversation(alice, bob);

		StompSession bobSession = connectSession(tokenFor(bob));
		BlockingQueue<Map<String, Object>> bobQueue = new LinkedBlockingQueue<>();
		bobSession.subscribe("/topic/chat/" + conversationId, new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				bobQueue.add((Map<String, Object>) payload);
			}
		});

		String requestBody = objectMapper.writeValueAsString(Map.of("content", "REST realtime message"));
		HttpRequest request = HttpRequest.newBuilder()
				.uri(URI.create("http://localhost:" + port + "/api/v1/chats/" + conversationId + "/messages"))
				.header("Authorization", "Bearer " + tokenFor(alice))
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(requestBody))
				.build();
		HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
		assertThat(response.statusCode()).isEqualTo(200);
		assertThat(objectMapper.readTree(response.body()).path("data").path("content").asText())
				.isEqualTo("REST realtime message");

		Map<String, Object> received = bobQueue.poll(10, TimeUnit.SECONDS);
		assertThat(received).isNotNull();
		assertThat(received.get("content")).isEqualTo("REST realtime message");
		assertThat(received.get("conversationId")).isEqualTo(conversationId.intValue());
	}

	@Test
	void persistedMessageSendsOneUserScopedNotificationToItsRecipient() throws Exception {
		User alice = createUser("alice-notification-ws", "Alice");
		User bob = createUser("bob-notification-ws", "Bob");
		markFriends(alice, bob);
		Long conversationId = openConversation(alice, bob);

		StompSession bobSession = connectSession(tokenFor(bob));
		BlockingQueue<Map<String, Object>> bobNotifications = new LinkedBlockingQueue<>();
		bobSession.subscribe("/user/queue/notifications", new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				bobNotifications.add((Map<String, Object>) payload);
			}
		});
		assertThat(simpUserRegistry.getUser(bob.getUsername())).isNotNull();

		var savedMessage = chatService.sendMessage(alice.getUsername(), conversationId,
				new SendMessageRequest("Notification event"));
		Map<String, Object> notification = bobNotifications.poll(10, TimeUnit.SECONDS);

		assertThat(notification).isNotNull();
		assertThat(notification.get("id")).isNotNull();
		assertThat(notification.get("recipientId")).isEqualTo(bob.getId().intValue());
		assertThat(notification.get("type")).isEqualTo("NEW_MESSAGE");
		assertThat(notification.get("referenceId")).isEqualTo(savedMessage.messageId().intValue());
		assertThat(notification.get("conversationId")).isEqualTo(conversationId.intValue());
		assertThat(bobNotifications).isEmpty();
	}

	@Test
	void nonParticipantCannotSendToConversation() throws Exception {
		User alice = createUser("alice-nonparticipant", "Alice");
		User bob = createUser("bob-nonparticipant", "Bob");
		User carol = createUser("carol-nonparticipant", "Carol");
		markFriends(alice, bob);

		Long conversationId = openConversation(alice, bob);

		StompSession carolSession = connectSession(tokenFor(carol));
		var before = chatService.listMessages(alice.getUsername(), conversationId, 50);
		assertThat(before.items()).isEmpty();

		carolSession.send("/app/chat/" + conversationId + "/send", Map.of("content", "Sneaky"));

		var after = chatService.listMessages(alice.getUsername(), conversationId, 50);
		assertThat(after.items()).isEmpty();
	}

	@Test
	void participantCannotPublishForgedMessageDirectlyToConversationTopic() throws Exception {
		User alice = createUser("alice-forged-ws", "Alice");
		User bob = createUser("bob-forged-ws", "Bob");
		markFriends(alice, bob);
		Long conversationId = openConversation(alice, bob);

		StompSession aliceSession = connectSession(tokenFor(alice));
		StompSession bobSession = connectSession(tokenFor(bob));
		BlockingQueue<Map<String, Object>> bobQueue = new LinkedBlockingQueue<>();
		bobSession.subscribe("/topic/chat/" + conversationId, new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				bobQueue.add((Map<String, Object>) payload);
			}
		});

		aliceSession.send("/topic/chat/" + conversationId, Map.of(
				"messageId", 999,
				"conversationId", conversationId,
				"senderId", bob.getId(),
				"content", "Forged message",
				"createdAt", Instant.now().toString()));

		assertThat(bobQueue.poll(1, TimeUnit.SECONDS)).isNull();
		assertThat(chatService.listMessages(alice.getUsername(), conversationId, 50).items()).isEmpty();
	}

	private Long openConversation(User alice, User bob) {
		return chatService.openDirectConversation(alice.getUsername(), new OpenDirectChatRequest(bob.getId()))
				.conversationId();
	}

	private StompSession connectSession(String token) throws Exception {
		WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
		stompClient.setMessageConverter(new MappingJackson2MessageConverter());
		StompHeaders headers = new StompHeaders();
		headers.add("Authorization", "Bearer " + token);
		return stompClient.connectAsync("ws://localhost:" + port + "/ws",
				new org.springframework.web.socket.WebSocketHttpHeaders(), headers, new StompSessionHandlerAdapter() {
					@Override
					public void afterConnected(StompSession session, StompHeaders connectedHeaders) {
					}
				}).get(10, TimeUnit.SECONDS);
	}

	private StompFrameHandler frameHandler(BlockingQueue<Map<String, Object>> queue) {
		return new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				queue.add((Map<String, Object>) payload);
			}
		};
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
}