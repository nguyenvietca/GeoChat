package com.geochat.user.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.geochat.common.response.ApiResponse;
import com.geochat.user.dto.UpdateMyProfileRequest;
import com.geochat.user.dto.UserResponse;
import com.geochat.user.dto.UserSearchResponse;
import com.geochat.user.service.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

	private final UserService userService;

	public UserController(UserService userService) {
		this.userService = userService;
	}

	@GetMapping("/{userId}/profile")
	public ApiResponse<com.geochat.user.dto.PublicProfileResponse> profile(@PathVariable Long userId) {
		return ApiResponse.ok(userService.publicProfile(userId));
	}

	@GetMapping("/{userId}/avatar")
	public ResponseEntity<byte[]> avatar(@PathVariable Long userId) {
		var avatar = userService.avatar(userId);
		return ResponseEntity.ok().contentType(MediaType.parseMediaType(avatar.contentType()))
				.cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff")
				.header("Content-Disposition", "inline; filename=avatar").body(avatar.bytes());
	}

	@PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ApiResponse<UserResponse> updateAvatar(@AuthenticationPrincipal UserDetails principal,
			@RequestParam("image") MultipartFile image) {
		return ApiResponse.ok(userService.updateAvatar(principal.getUsername(), image));
	}

	@GetMapping("/me")
	public ApiResponse<UserResponse> getCurrentUser(@AuthenticationPrincipal UserDetails principal) {
		return ApiResponse.ok(userService.getCurrentUser(principal.getUsername()));
	}

	@PatchMapping("/me")
	public ApiResponse<UserResponse> updateCurrentUser(@AuthenticationPrincipal UserDetails principal,
			@Valid @RequestBody UpdateMyProfileRequest request) {
		return ApiResponse.ok(userService.updateCurrentUser(principal.getUsername(), request));
	}

	@GetMapping("/search")
	public ApiResponse<UserSearchResponse> searchUsers(@AuthenticationPrincipal UserDetails principal,
			@RequestParam("q") String q, @RequestParam(value = "page", defaultValue = "0") int page) {
		return ApiResponse.ok(userService.searchUsers(principal.getUsername(), q, page));
	}
}
