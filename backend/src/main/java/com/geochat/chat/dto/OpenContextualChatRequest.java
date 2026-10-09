package com.geochat.chat.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record OpenContextualChatRequest(
        @NotNull(message = "userId is required") Long userId,
        @DecimalMin(value = "1", message = "radius must be at least 1 meter")
        @DecimalMax(value = "100000", message = "radius must be at most 100000 meters")
        Double radiusMeters
) {
}