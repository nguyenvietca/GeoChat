package com.geochat.friend.dto;

public record UserSummaryResponse(
        Long userId,
        String username,
        String displayName
) {
}
