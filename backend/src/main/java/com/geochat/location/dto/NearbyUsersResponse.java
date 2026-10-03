package com.geochat.location.dto;

import java.util.List;

public record NearbyUsersResponse(
        List<NearbyUserResponse> items,
        Double radiusMeters
) {
}
