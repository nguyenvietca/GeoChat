package com.geochat.chat.websocket;

import com.geochat.chat.event.ConversationActivityEvent;
import com.geochat.chat.repository.ConversationParticipantRepository;
import com.geochat.user.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ConversationActivityEventListener {
    private final ConversationParticipantRepository participants;
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;

    public ConversationActivityEventListener(ConversationParticipantRepository participants,
                                             UserRepository users, SimpMessagingTemplate messaging) {
        this.participants = participants;
        this.users = users;
        this.messaging = messaging;
    }

    @TransactionalEventListener
    public void publish(ConversationActivityEvent event) {
        var ids = participants.findByConversationIdOrderByIdAsc(event.message().conversationId()).stream()
                .map(member -> member.getUserId()).toList();
        for (var user : users.findAllById(ids)) {
            messaging.convertAndSendToUser(user.getUsername(), "/queue/conversation-activity", event);
        }
    }
}
