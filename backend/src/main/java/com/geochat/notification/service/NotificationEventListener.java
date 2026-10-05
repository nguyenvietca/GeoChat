package com.geochat.notification.service;

import com.geochat.notification.event.FriendRequestAcceptedEvent;
import com.geochat.notification.event.FriendRequestCreatedEvent;
import com.geochat.notification.event.MessageCreatedEvent;
import com.geochat.notification.dto.NotificationResponse;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final PushNotificationService pushNotificationService;

    public NotificationEventListener(
            NotificationService notificationService,
            PushNotificationService pushNotificationService) {
        this.notificationService = notificationService;
        this.pushNotificationService = pushNotificationService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFriendRequestCreated(FriendRequestCreatedEvent event) {
        NotificationResponse notification = notificationService.createFriendRequestReceived(
                event.recipientId(),
                event.requestId(),
                event.senderDisplayName()
        );
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
                event.senderDisplayName()
        );
        pushNotificationService.send(notification.recipientId(), notification.title(), notification.message(), Map.of(
                "type", notification.type().name(),
                "notificationId", notification.id(),
                "conversationId", event.conversationId(),
                "senderId", event.senderId()));
    }
}
