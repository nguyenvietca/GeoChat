package com.geochat.notification.event;

public record FriendRequestAcceptedEvent(
        Long requestId,
        Long recipientId,
        Long accepterId,
        String accepterDisplayName
) {}
