package com.geochat.notification.event;

public record MessageCreatedEvent(
        Long messageId,
        Long recipientId,
        Long senderId,
        String senderDisplayName
) {}
