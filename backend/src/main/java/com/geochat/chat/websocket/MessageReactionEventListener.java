package com.geochat.chat.websocket;

import com.geochat.chat.event.MessageReactionsChangedEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class MessageReactionEventListener {
    private final SimpMessagingTemplate template;
    public MessageReactionEventListener(SimpMessagingTemplate template) { this.template = template; }

    @TransactionalEventListener
    public void onChanged(MessageReactionsChangedEvent event) {
        template.convertAndSend("/topic/chat/" + event.conversationId() + "/reactions", event);
    }
}
