package com.geochat.notification.dto;

import java.util.List;

public record NotificationListResponse(
        List<NotificationResponse> items,
        long unreadCount,
        long total,
        int limit,
        int offset,
        boolean hasMore
) {}
