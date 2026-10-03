package com.geochat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
        @NotBlank(message = "message content is required")
        @Size(max = 5000, message = "message content must be at most 5000 characters")
        String content
) {
}
