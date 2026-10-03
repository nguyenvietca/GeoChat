package com.geochat.location.service;

import com.geochat.location.dto.LocationResponse;
import com.geochat.location.dto.NearbyUserResponse;
import com.geochat.location.dto.NearbyUsersResponse;
import com.geochat.location.dto.UpdateLocationRequest;
import com.geochat.location.entity.UserLocation;
import com.geochat.location.repository.NearbyUserRow;
import com.geochat.location.repository.UserLocationRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class LocationService {

    public static final double MAX_RADIUS_METERS = 100_000.0;
    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 100;

    private final UserRepository userRepository;
    private final UserLocationRepository locationRepository;

    public LocationService(UserRepository userRepository, UserLocationRepository locationRepository) {
        this.userRepository = userRepository;
        this.locationRepository = locationRepository;
    }

    @Transactional
    public LocationResponse updateCurrentLocation(String username, UpdateLocationRequest request) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        UserLocation location = locationRepository.findByUserId(user.getId())
                .orElseGet(UserLocation::new);
        location.setUserId(user.getId());
        location.setLatitude(request.latitude());
        location.setLongitude(request.longitude());
        location.setUpdatedAt(Instant.now());

        return toResponse(locationRepository.save(location));
    }

    @Transactional(readOnly = true)
    public LocationResponse getCurrentLocation(String username) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        UserLocation location = locationRepository.findByUserId(user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Current location not found"));
        return toResponse(location);
    }

    @Transactional(readOnly = true)
    public NearbyUsersResponse getNearbyUsers(String username, Double radiusMeters, Integer limit) {
        if (radiusMeters == null) {
            throw new IllegalArgumentException("Radius is required");
        }
        if (radiusMeters <= 0 || radiusMeters > MAX_RADIUS_METERS) {
            throw new IllegalArgumentException("Radius must be greater than 0 and less than or equal to "
                    + MAX_RADIUS_METERS + " meters");
        }

        int validatedLimit = (limit == null) ? DEFAULT_LIMIT : limit;
        if (validatedLimit <= 0) {
            throw new IllegalArgumentException("Limit must be greater than 0");
        }
        if (validatedLimit > MAX_LIMIT) {
            throw new IllegalArgumentException("Limit must be less than or equal to " + MAX_LIMIT);
        }

        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        UserLocation currentLocation = locationRepository.findByUserId(user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Current location not found"));

        List<NearbyUserRow> nearbyUsers = locationRepository.findNearbyUsers(
                user.getId(),
                currentLocation.getLatitude(),
                currentLocation.getLongitude(),
                radiusMeters,
                validatedLimit
        );

        List<NearbyUserResponse> items = nearbyUsers.stream()
                .map(result -> new NearbyUserResponse(result.userId(), result.displayName(), result.distanceMeters()))
                .toList();

        return new NearbyUsersResponse(items, radiusMeters);
    }

    private LocationResponse toResponse(UserLocation location) {
        return new LocationResponse(location.getLatitude(), location.getLongitude(), location.getUpdatedAt());
    }
}