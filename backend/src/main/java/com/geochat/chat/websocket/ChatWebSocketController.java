package com.geochat.chat.websocket;

import com.geochat.chat.dto.ChatDtos.MessageResponse;
import com.geochat.chat.dto.ChatDtos.TypingEventResponse;
import com.geochat.chat.dto.ChatDtos.TypingRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.context.event.EventListener;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatWebSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketSessionRegistry sessions;
    private final AtomicLong typingSequence = new AtomicLong();
    private final ConcurrentHashMap<String, ConcurrentHashMap<Long, Long>> typingActivities = new ConcurrentHashMap<>();

    public ChatWebSocketController(ChatService chatService, SimpMessagingTemplate messagingTemplate, WebSocketSessionRegistry sessions) {
        this.chatService = chatService;
        this.messagingTemplate = messagingTemplate;
        this.sessions = sessions;
    }

    @MessageMapping("/chat/{conversationId}/send")
    public void sendMessage(@DestinationVariable Long conversationId,
                           @Payload SendMessageRequest request,
                           Principal principal,
                           SimpMessageHeaderAccessor headerAccessor) {
        String username = principal != null ? principal.getName() : null;
        if (username == null && headerAccessor != null && headerAccessor.getSessionAttributes() != null) {
            Object sessionUsername = headerAccessor.getSessionAttributes().get("username");
            if (sessionUsername != null) {
                username = sessionUsername.toString();
            }
        }
        if (username == null || username.isBlank()) {
            throw new AccessDeniedException("Authentication required");
        }

        MessageResponse message = chatService.sendMessageFromWebSocket(username, conversationId, request.content());
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, message);
    }

    @MessageMapping("/chat/{conversationId}/typing")
    public void updateTyping(@DestinationVariable Long conversationId,
                             @Payload TypingRequest request,
                             @Header(SimpMessageHeaderAccessor.SESSION_ID_HEADER) String sessionId,
                             Principal principal) {
        if (principal == null || principal.getName() == null || request == null || sessionId == null) {
            throw new AccessDeniedException("Authentication required");
        }
        if (request.activityId() != null && request.activityId() <= 0) {
            throw new IllegalArgumentException("activityId must be positive");
        }
        var history = typingActivities.computeIfAbsent(sessionId, id -> new ConcurrentHashMap<>());
        history.compute(conversationId, (id, previous) -> {
            if (request.activityId() != null && previous != null && request.activityId() <= previous) return previous;
            var identity = chatService.createTypingEvent(principal.getName(), conversationId, request.state());
            String username = sessions.getUsername(sessionId);
            if (username == null || !username.equalsIgnoreCase(principal.getName())) {
                throw new AccessDeniedException("Authentication required");
            }
            var event = new TypingEventResponse(conversationId, identity.senderId(), identity.senderDisplayName(),
                    "TYPING", identity.state(), typingSequence.incrementAndGet());
            messagingTemplate.convertAndSend("/topic/chat/" + conversationId + "/typing", event);
            return request.activityId() == null ? previous : request.activityId();
        });
    }

    @EventListener
    public void clearTypingSession(SessionDisconnectEvent event) {
        typingActivities.remove(event.getSessionId());
    }
}
