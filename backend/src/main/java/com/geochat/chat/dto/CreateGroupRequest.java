package com.geochat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateGroupRequest(
        @NotBlank(message = "group name is required")
        @Size(max = 100, message = "group name must be at most 100 characters")
        String name,
        List<Long> memberIds
) {
}