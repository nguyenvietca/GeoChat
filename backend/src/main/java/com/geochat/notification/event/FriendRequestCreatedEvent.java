package com.geochat.notification.event;

public record FriendRequestCreatedEvent(
        Long requestId,
        Long recipientId,
        Long senderId,
        String senderDisplayName
) {}
