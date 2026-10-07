package com.geochat.friend.dto;

public record FriendSummaryResponse(
        Long userId,
        String username,
        String displayName
) {
}
