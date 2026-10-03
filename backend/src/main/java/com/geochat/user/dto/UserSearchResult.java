package com.geochat.user.dto;

public record UserSearchResult(
        Long userId,
        String displayName,
        String username,
        String relationship
) {
}
