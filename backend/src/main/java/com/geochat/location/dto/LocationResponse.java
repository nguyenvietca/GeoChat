package com.geochat.location.dto;

import java.time.Instant;

public record LocationResponse(
        Double latitude,
        Double longitude,
        Instant updatedAt
) {
}