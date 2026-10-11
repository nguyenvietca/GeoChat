package com.geochat.location.repository;

import java.util.List;

public interface UserLocationSearchRepository {
    default List<NearbyUserRow> findNearbyUsers(Long id,Double lat,Double lng,Double radius,Integer limit) { return findNearbyUsers(id,lat,lng,radius,limit,0); }

    List<NearbyUserRow> findNearbyUsers(Long currentUserId, Double currentLatitude, Double currentLongitude,
                                      Double radiusMeters, Integer limit, Integer offset);

    boolean isWithinRadius(Long currentUserId, Long targetUserId, Double currentLatitude,
                           Double currentLongitude, Double radiusMeters);
}
