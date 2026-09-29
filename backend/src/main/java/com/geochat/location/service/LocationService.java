package com.geochat.location.service;

import com.geochat.location.dto.LocationResponse;
import com.geochat.location.dto.UpdateLocationRequest;
import com.geochat.location.entity.UserLocation;
import com.geochat.location.repository.UserLocationRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class LocationService {

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

    private LocationResponse toResponse(UserLocation location) {
        return new LocationResponse(location.getLatitude(), location.getLongitude(), location.getUpdatedAt());
    }
}