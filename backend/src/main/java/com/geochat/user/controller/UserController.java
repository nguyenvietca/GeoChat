package com.geochat.user.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.geochat.common.response.ApiResponse;
import com.geochat.user.dto.UserResponse;
import com.geochat.user.dto.UserSearchResponse;
import com.geochat.user.service.UserService;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

	private final UserService userService;

	public UserController(UserService userService) {
		this.userService = userService;
	}

	@GetMapping("/me")
	public ApiResponse<UserResponse> getCurrentUser(@AuthenticationPrincipal UserDetails principal) {
		return ApiResponse.ok(userService.getCurrentUser(principal.getUsername()));
	}

	@GetMapping("/search")
	public ApiResponse<UserSearchResponse> searchUsers(@AuthenticationPrincipal UserDetails principal,
			@RequestParam("q") String q) {
		return ApiResponse.ok(userService.searchUsers(principal.getUsername(), q));
	}
}
