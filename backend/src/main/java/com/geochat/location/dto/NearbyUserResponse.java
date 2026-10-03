package com.geochat.location.dto;

public record NearbyUserResponse(
        Long userId,
        String displayName,
        Double distanceMeters
) {
}
