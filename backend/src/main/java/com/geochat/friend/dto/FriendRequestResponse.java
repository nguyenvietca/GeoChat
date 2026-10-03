package com.geochat.friend.dto;

import com.geochat.friend.entity.FriendRequestStatus;

import java.time.Instant;

public record FriendRequestResponse(
        Long requestId,
        Long senderId,
        Long receiverId,
        FriendRequestStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
