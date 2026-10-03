package com.geochat.chat.dto;

import jakarta.validation.constraints.NotNull;

public record OpenDirectChatRequest(
        @NotNull(message = "userId is required") Long userId
) {
}
