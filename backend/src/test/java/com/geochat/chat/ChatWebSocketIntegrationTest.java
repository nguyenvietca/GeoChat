package com.geochat.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.geochat.auth.security.JwtService;
import com.geochat.chat.dto.OpenDirectChatRequest;
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
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        friendRequestRepository.deleteAll();
        userRepository.deleteAll();
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
        assertThatThrownBy(() -> connectSession("bad-token"))
                .isInstanceOf(Exception.class);
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

    private Long openConversation(User alice, User bob) {
        return chatService.openDirectConversation(alice.getUsername(), new OpenDirectChatRequest(bob.getId())).conversationId();
    }

    private StompSession connectSession(String token) throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);
        return stompClient.connectAsync("ws://localhost:" + port + "/ws", new org.springframework.web.socket.WebSocketHttpHeaders(), headers,
                new StompSessionHandlerAdapter() {
                    @Override
                    public void afterConnected(StompSession session, StompHeaders connectedHeaders) {
                    }
                }).get(10, TimeUnit.SECONDS);
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
