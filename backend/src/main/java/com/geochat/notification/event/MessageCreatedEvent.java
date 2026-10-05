package com.geochat.notification.event;

public record MessageCreatedEvent(
        Long messageId,
        Long conversationId,
        Long recipientId,
        Long senderId,
        String senderDisplayName
) {}
