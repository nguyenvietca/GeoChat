package com.geochat.notification.service;

import com.geochat.notification.event.FriendRequestAcceptedEvent;
import com.geochat.notification.event.FriendRequestCreatedEvent;
import com.geochat.notification.event.MessageCreatedEvent;
import com.geochat.notification.dto.NotificationResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class NotificationEventListener {
        private static final Logger logger = LoggerFactory.getLogger(NotificationEventListener.class);

    private final NotificationService notificationService;
    private final PushNotificationService pushNotificationService;
        private final SimpMessagingTemplate messagingTemplate;

    public NotificationEventListener(
            NotificationService notificationService,
                        PushNotificationService pushNotificationService,
                        SimpMessagingTemplate messagingTemplate) {
        this.notificationService = notificationService;
        this.pushNotificationService = pushNotificationService;
                this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFriendRequestCreated(FriendRequestCreatedEvent event) {
        NotificationResponse notification = notificationService.createFriendRequestReceived(
                event.recipientId(),
                event.requestId(),
                event.senderDisplayName()
        );
        sendRealtime(notification);
        pushNotificationService.send(notification.recipientId(), notification.title(), notification.message(), Map.of(
                "type", notification.type().name(),
                "notificationId", notification.id(),
                "friendRequestId", event.requestId(),
                "senderId", event.senderId()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFriendRequestAccepted(FriendRequestAcceptedEvent event) {
        NotificationResponse notification = notificationService.createFriendRequestAccepted(
                event.recipientId(),
                event.requestId(),
                event.accepterDisplayName()
        );
        sendRealtime(notification);
        pushNotificationService.send(notification.recipientId(), notification.title(), notification.message(), Map.of(
                "type", notification.type().name(),
                "notificationId", notification.id(),
                "friendRequestId", event.requestId(),
                "senderId", event.accepterId()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageCreated(MessageCreatedEvent event) {
        NotificationResponse notification = notificationService.createNewMessage(
                event.recipientId(),
                event.messageId(),
                event.conversationId(),
                event.senderDisplayName()
        );
        sendRealtime(notification);
        pushNotificationService.send(notification.recipientId(), notification.title(), notification.message(), Map.of(
                "type", notification.type().name(),
                "notificationId", notification.id(),
                "conversationId", event.conversationId(),
                "senderId", event.senderId()));
    }

        private void sendRealtime(NotificationResponse notification) {
                try {
                        String username = notificationService.getRecipientUsername(notification.recipientId());
                        messagingTemplate.convertAndSendToUser(username, "/queue/notifications", notification);
                } catch (RuntimeException exception) {
                        logger.warn("Unable to deliver realtime notification {}", notification.id());
                }
        }
}
