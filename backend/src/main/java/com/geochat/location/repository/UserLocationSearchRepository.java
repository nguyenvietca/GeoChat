package com.geochat.location.repository;

import java.util.List;

public interface UserLocationSearchRepository {
    List<NearbyUserRow> findNearbyUsers(Long currentUserId, Double currentLatitude, Double currentLongitude,
                                      Double radiusMeters, Integer limit);
}
