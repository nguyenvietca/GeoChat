package com.geochat.notification.service;

import com.geochat.notification.event.FriendRequestAcceptedEvent;
import com.geochat.notification.event.FriendRequestCreatedEvent;
import com.geochat.notification.event.MessageCreatedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class NotificationEventListener {

    private final NotificationService notificationService;

    public NotificationEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @EventListener
    public void onFriendRequestCreated(FriendRequestCreatedEvent event) {
        notificationService.createFriendRequestReceived(
                event.recipientId(),
                event.requestId(),
                event.senderDisplayName()
        );
    }

    @EventListener
    public void onFriendRequestAccepted(FriendRequestAcceptedEvent event) {
        notificationService.createFriendRequestAccepted(
                event.recipientId(),
                event.requestId(),
                event.accepterDisplayName()
        );
    }

    @EventListener
    public void onMessageCreated(MessageCreatedEvent event) {
        notificationService.createNewMessage(
                event.recipientId(),
                event.messageId(),
                event.senderDisplayName()
        );
    }
}
