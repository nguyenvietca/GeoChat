package com.geochat.chat.websocket;

import com.geochat.chat.repository.UnreadStateRow;
import com.geochat.chat.dto.ChatDtos.ConversationActivityResponse;
import com.geochat.chat.event.ConversationReadEvent;
import com.geochat.user.entity.User;

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
        var states = participants.findUnreadStatesForConversation(event.message().conversationId());
        var ids = states.stream().map(UnreadStateRow::getUserId).toList();
        var usersById = users.findAllById(ids).stream().collect(java.util.stream.Collectors.toMap(
                User::getId, java.util.function.Function.identity()));
        for (var state : states) {
            var user = usersById.get(state.getUserId());
            if (user != null) messaging.convertAndSendToUser(user.getUsername(), "/queue/conversation-activity",
                    new ConversationActivityResponse(event.message(), event.senderDisplayName(),
                            state.getUnreadCount(), state.getReadStateVersion(), state.getReadStateSince()));
        }
    }

    @TransactionalEventListener
    public void publishRead(ConversationReadEvent event) {
        messaging.convertAndSendToUser(event.username(), "/queue/conversation-read", event.state());
    }
}
