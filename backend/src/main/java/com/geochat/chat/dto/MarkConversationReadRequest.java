package com.geochat.chat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record MarkConversationReadRequest(@NotNull @Positive Long messageId) {}
