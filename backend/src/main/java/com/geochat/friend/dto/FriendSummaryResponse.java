package com.geochat.friend.dto;

public record FriendSummaryResponse(Long userId, String username, String displayName,
		java.time.Instant avatarUpdatedAt) {
	public FriendSummaryResponse(Long userId, String username, String displayName) {
		this(userId, username, displayName, null);
	}
}
