package com.geochat.user.dto;

import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;

import java.time.Instant;

public record UserResponse(
        Long id,
        String username,
        String displayName,
        UserStatus status,
        Instant createdAt,
        Instant updatedAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getStatus(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
