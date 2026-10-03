package com.geochat.chat.websocket;

import com.geochat.chat.dto.ChatDtos.MessageResponse;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatWebSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatWebSocketController(ChatService chatService, SimpMessagingTemplate messagingTemplate) {
        this.chatService = chatService;
        this.messagingTemplate = messagingTemplate;
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
}
