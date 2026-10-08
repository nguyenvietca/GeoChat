package com.geochat.friend.controller;

import com.geochat.common.response.ApiResponse;
import com.geochat.friend.dto.CreateFriendRequestRequest;
import com.geochat.friend.dto.FriendListResponse;
import com.geochat.friend.dto.FriendRequestListResponse;
import com.geochat.friend.dto.FriendRequestResponse;
import com.geochat.friend.service.FriendRequestService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class FriendRequestController {

	private final FriendRequestService friendRequestService;

	public FriendRequestController(FriendRequestService friendRequestService) {
		this.friendRequestService = friendRequestService;
	}

	@PostMapping("/friends/requests")
	public ApiResponse<FriendRequestResponse> createFriendRequest(@AuthenticationPrincipal UserDetails principal,
			@Valid @RequestBody CreateFriendRequestRequest request) {
		return ApiResponse.ok(friendRequestService.createFriendRequest(principal.getUsername(), request));
	}

	@PostMapping("/friends/requests/{requestId}/accept")
	public ApiResponse<FriendRequestResponse> acceptFriendRequest(@AuthenticationPrincipal UserDetails principal,
			@PathVariable Long requestId) {
		return ApiResponse.ok(friendRequestService.acceptRequest(principal.getUsername(), requestId));
	}

	@PostMapping("/friends/requests/{requestId}/reject")
	public ApiResponse<FriendRequestResponse> rejectFriendRequest(@AuthenticationPrincipal UserDetails principal,
			@PathVariable Long requestId) {
		return ApiResponse.ok(friendRequestService.rejectRequest(principal.getUsername(), requestId));
	}

	@PostMapping("/friends/requests/{requestId}/cancel")
	public ApiResponse<FriendRequestResponse> cancelFriendRequest(@AuthenticationPrincipal UserDetails principal,
			@PathVariable Long requestId) {
		return ApiResponse.ok(friendRequestService.cancelRequest(principal.getUsername(), requestId));
	}

	@GetMapping("/friends/requests/incoming")
	public ApiResponse<FriendRequestListResponse> getIncomingFriendRequests(
			@AuthenticationPrincipal UserDetails principal) {
		return ApiResponse.ok(friendRequestService.getIncomingFriendRequests(principal.getUsername()));
	}

	@GetMapping("/friends/requests/outgoing")
	public ApiResponse<FriendRequestListResponse> getOutgoingFriendRequests(
			@AuthenticationPrincipal UserDetails principal) {
		return ApiResponse.ok(friendRequestService.getOutgoingFriendRequests(principal.getUsername()));
	}

	@GetMapping("/friends")
	public ApiResponse<FriendListResponse> getFriends(@AuthenticationPrincipal UserDetails principal) {
		return ApiResponse.ok(friendRequestService.getFriends(principal.getUsername()));
	}

	@DeleteMapping("/friends/{friendId}")
	public ApiResponse<Void> removeFriend(@AuthenticationPrincipal UserDetails principal,
			@PathVariable Long friendId) {
		friendRequestService.removeFriend(principal.getUsername(), friendId);
		return ApiResponse.ok(null);
	}
}
