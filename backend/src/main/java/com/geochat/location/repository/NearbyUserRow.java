package com.geochat.location.repository;

public record NearbyUserRow(Long userId, String displayName, Double distanceMeters) {
}
