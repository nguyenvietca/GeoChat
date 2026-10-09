package com.geochat.chat.websocket;

import com.geochat.chat.event.GroupManagementEvent;
import com.geochat.chat.repository.ConversationParticipantRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT;

@Component
public class GroupManagementEventListener {

    private final ConversationParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public GroupManagementEventListener(ConversationParticipantRepository participantRepository,
                                        UserRepository userRepository,
                                        SimpMessagingTemplate messagingTemplate) {
        this.participantRepository = participantRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    public void publish(GroupManagementEvent event) {
        LinkedHashSet<Long> recipientIds = participantRepository
                .findByConversationIdOrderByIdAsc(event.group().groupId()).stream()
                .map(participant -> participant.getId().getUserId())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (event.member() != null && ("MEMBER_REMOVED".equals(event.type()) || "MEMBER_LEFT".equals(event.type()))) {
            recipientIds.add(event.member().user().userId());
        }

        Map<Long, User> recipients = userRepository.findAllById(recipientIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        for (Long recipientId : recipientIds) {
            User recipient = recipients.get(recipientId);
            if (recipient != null) {
                messagingTemplate.convertAndSendToUser(recipient.getUsername(), "/queue/group-events", event);
            }
        }
    }
}