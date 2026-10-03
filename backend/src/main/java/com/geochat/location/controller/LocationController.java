package com.geochat.location.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.geochat.common.response.ApiResponse;
import com.geochat.location.dto.LocationResponse;
import com.geochat.location.dto.NearbyUsersResponse;
import com.geochat.location.dto.UpdateLocationRequest;
import com.geochat.location.service.LocationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/locations")
public class LocationController {

	private final LocationService locationService;

	public LocationController(LocationService locationService) {
		this.locationService = locationService;
	}

	@PostMapping("/me")
	public ApiResponse<LocationResponse> updateCurrentLocation(@AuthenticationPrincipal UserDetails principal,
			@Valid @RequestBody UpdateLocationRequest request) {
		return ApiResponse.ok(locationService.updateCurrentLocation(principal.getUsername(), request));
	}

	@GetMapping("/me")
	public ApiResponse<LocationResponse> getCurrentLocation(@AuthenticationPrincipal UserDetails principal) {
		return ApiResponse.ok(locationService.getCurrentLocation(principal.getUsername()));
	}

	@GetMapping("/nearby")
	public ApiResponse<NearbyUsersResponse> getNearbyUsers(@AuthenticationPrincipal UserDetails principal,
			@RequestParam("radius") Double radius, @RequestParam(value = "limit", defaultValue = "20") Integer limit) {
		return ApiResponse.ok(locationService.getNearbyUsers(principal.getUsername(), radius, limit));
	}
}