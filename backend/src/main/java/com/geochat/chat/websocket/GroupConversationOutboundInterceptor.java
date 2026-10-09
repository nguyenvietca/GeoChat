package com.geochat.chat.websocket;

import com.geochat.chat.service.ChatService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class GroupConversationOutboundInterceptor implements ChannelInterceptor {

    private static final Pattern CHAT_DESTINATION = Pattern.compile("/topic/chat/(\\d+)");

    private final ChatService chatService;
    private final WebSocketSessionRegistry webSocketSessionRegistry;

    public GroupConversationOutboundInterceptor(ChatService chatService,
                                                WebSocketSessionRegistry webSocketSessionRegistry) {
        this.chatService = chatService;
        this.webSocketSessionRegistry = webSocketSessionRegistry;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        SimpMessageHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, SimpMessageHeaderAccessor.class);
        if (accessor == null || accessor.getSessionId() == null) {
            return message;
        }
        Matcher matcher = CHAT_DESTINATION.matcher(accessor.getDestination() == null ? "" : accessor.getDestination());
        if (!matcher.matches()) {
            return message;
        }

        String username = webSocketSessionRegistry.getUsername(accessor.getSessionId());
        if (username == null) {
            return null;
        }
        Long conversationId = Long.valueOf(matcher.group(1));
        return chatService.isParticipant(username, conversationId) ? message : null;
    }

}