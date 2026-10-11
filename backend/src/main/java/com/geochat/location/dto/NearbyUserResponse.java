package com.geochat.location.dto;

public record NearbyUserResponse(Long userId, String displayName, Double distanceMeters, MapArea mapArea) {
    public record MapArea(String key, double centerLatitude, double centerLongitude, double cellDegrees) {
    }
}
