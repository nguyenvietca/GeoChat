package com.geochat.chat.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record AddGroupMembersRequest(
        @NotEmpty(message = "memberIds is required")
        List<Long> memberIds
) {
}
