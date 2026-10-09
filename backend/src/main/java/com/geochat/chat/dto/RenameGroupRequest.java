package com.geochat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameGroupRequest(
        @NotBlank(message = "group name is required")
        @Size(max = 100, message = "group name must be at most 100 characters")
        String name
) {
}