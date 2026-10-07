package com.geochat.notification.dto;

import java.time.Instant;

import com.geochat.notification.enumtype.NotificationReferenceType;
import com.geochat.notification.enumtype.NotificationType;

public record NotificationResponse(Long id, Long recipientId, NotificationType type, String title, String message,
		NotificationReferenceType referenceType, Long referenceId, Long conversationId, boolean read, Instant createdAt,
		Instant readAt) {
}
