package com.geochat.friend.dto;

public record UserSummaryResponse(
        Long userId,
        String username,
        String displayName,
        java.time.Instant avatarUpdatedAt
) {
    public UserSummaryResponse(Long userId, String username, String displayName) {
        this(userId, username, displayName, null);
    }
}
