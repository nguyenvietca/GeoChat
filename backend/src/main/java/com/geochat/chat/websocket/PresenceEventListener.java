package com.geochat.chat.websocket;

import com.geochat.chat.dto.ChatDtos.UserPresenceResponse;
import com.geochat.chat.event.WebSocketPresenceChangedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class PresenceEventListener {

    private final SimpMessagingTemplate messagingTemplate;

    public PresenceEventListener(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void publish(WebSocketPresenceChangedEvent event) {
        messagingTemplate.convertAndSend("/topic/presence/" + event.userId(),
                new UserPresenceResponse(event.userId(), event.online()));
    }
}