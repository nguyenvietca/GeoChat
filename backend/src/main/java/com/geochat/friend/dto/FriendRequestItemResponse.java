package com.geochat.friend.dto;

import java.time.Instant;

public record FriendRequestItemResponse(
        Long requestId,
        UserSummaryResponse user,
        Instant createdAt
) {
}
