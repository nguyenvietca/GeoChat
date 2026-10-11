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
    private final NearbyRequestGuard guard;
    private final UserLocationRepository locationRepository;

    public LocationService(UserRepository userRepository, UserLocationRepository locationRepository, NearbyRequestGuard guard) {
        this.guard=guard;
        this.userRepository = userRepository;
        this.locationRepository = locationRepository;
    }

    @Transactional
    public LocationResponse updateCurrentLocation(String username, UpdateLocationRequest request) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if(request==null||request.latitude()==null||request.longitude()==null||!Double.isFinite(request.latitude())||!Double.isFinite(request.longitude())||Math.abs(request.latitude())>90||Math.abs(request.longitude())>180)throw new IllegalArgumentException("Invalid location");
        guard.check(username+":update",10);
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
    public NearbyUsersResponse getNearbyUsers(String username, Double radiusMeters, Integer limit) {return getNearbyUsers(username,radiusMeters,limit,0);}
    @Transactional(readOnly=true)
    public NearbyUsersResponse getNearbyUsers(String username, Double radiusMeters, Integer limit, int page) {
        if(page<0||page>4)throw new IllegalArgumentException("Page must be between 0 and 4");
        if (radiusMeters == null) {
            throw new IllegalArgumentException("Radius is required");
        }
        if (!Double.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > MAX_RADIUS_METERS) {
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

        if(currentLocation.getUpdatedAt().isBefore(Instant.now().minusSeconds(86400)))throw new IllegalArgumentException("Refresh your location before searching nearby");
        guard.check(username+":search",20);
        List<NearbyUserRow> nearbyUsers = locationRepository.findNearbyUsers(
                user.getId(),
                currentLocation.getLatitude(),
                currentLocation.getLongitude(),
                radiusMeters,
                validatedLimit+1, page*validatedLimit
        );

        List<NearbyUserResponse> items = nearbyUsers.stream().limit(validatedLimit)
                .map(result -> new NearbyUserResponse(result.userId(), result.displayName(), Math.floor(result.distanceMeters()/1000)*1000, new NearbyUserResponse.MapArea(result.areaLatitude()+":"+result.areaLongitude(),result.areaLatitude(),result.areaLongitude(),0.05)))
                .toList();

        return new NearbyUsersResponse(items, radiusMeters, page, page<4&&nearbyUsers.size()>validatedLimit);
    }

    @Transactional(readOnly = true)
    public boolean isWithinRadius(String username, Long targetUserId, Double radiusMeters) {
        if (radiusMeters == null || !Double.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > MAX_RADIUS_METERS) {
            return false;
        }
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        UserLocation currentLocation = locationRepository.findByUserId(user.getId()).orElse(null);
        if (currentLocation == null || currentLocation.getUpdatedAt().isBefore(Instant.now().minusSeconds(86400))) {
            return false;
        }
        guard.check(username+":search",20);
        return locationRepository.isWithinRadius(user.getId(), targetUserId,
                currentLocation.getLatitude(), currentLocation.getLongitude(), radiusMeters);
    }

    public record Discoverability(boolean discoverable) {}
    @Transactional(readOnly=true) public Discoverability discoverability(String username){return new Discoverability(userRepository.findByUsernameIgnoreCase(username).orElseThrow().isNearbyDiscoverable());}
    @Transactional public Discoverability setDiscoverability(String username,boolean value){var user=userRepository.findByUsernameIgnoreCase(username).orElseThrow();user.setNearbyDiscoverable(value);userRepository.save(user);return new Discoverability(value);}

    private LocationResponse toResponse(UserLocation location) {
        return new LocationResponse(location.getLatitude(), location.getLongitude(), location.getUpdatedAt());
    }
}