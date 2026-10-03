package com.geochat.friend.dto;

import jakarta.validation.constraints.NotNull;

public record CreateFriendRequestRequest(
        @NotNull(message = "User ID is required") Long userId
) {
}
