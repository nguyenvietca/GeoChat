package com.geochat.chat.websocket;

import com.geochat.chat.service.ChatService;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class TypingPresenceOutboundInterceptorTest {
    private final ChatService chat = mock(ChatService.class);
    private final WebSocketSessionRegistry sessions = mock(WebSocketSessionRegistry.class);
    private final GroupConversationOutboundInterceptor interceptor = new GroupConversationOutboundInterceptor(chat, sessions);

    private Message<?> frame(String destination) {
        var headers = StompHeaderAccessor.create(StompCommand.MESSAGE);
        headers.setSessionId("observer"); headers.setDestination(destination); headers.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }

    @Test void presenceDeliveryRechecksPermissionAfterSubscription() {
        when(sessions.getUsername("observer")).thenReturn("bob");
        var event = frame("/topic/presence/22");
        when(chat.canViewPresence("bob", 22L)).thenReturn(true);
        assertThat(interceptor.preSend(event, null)).isSameAs(event);
        when(chat.canViewPresence("bob", 22L)).thenReturn(false);
        assertThat(interceptor.preSend(event, null)).isNull();
    }

    @Test void removedTypingSubscriberAndExpiredSessionCannotReceiveTyping() {
        when(sessions.getUsername("observer")).thenReturn("bob");
        var event = frame("/topic/chat/50/typing");
        when(chat.isParticipant("bob", 50L)).thenReturn(true);
        assertThat(interceptor.preSend(event, null)).isSameAs(event);
        when(chat.isParticipant("bob", 50L)).thenReturn(false);
        assertThat(interceptor.preSend(event, null)).isNull();
        when(sessions.getUsername("observer")).thenReturn(null);
        assertThat(interceptor.preSend(event, null)).isNull();
    }
}
