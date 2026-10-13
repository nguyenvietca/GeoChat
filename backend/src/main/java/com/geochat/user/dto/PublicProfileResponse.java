package com.geochat.user.dto;

import java.time.Instant;

import com.geochat.user.entity.User;

public record PublicProfileResponse(Long userId, String username, String displayName, Instant avatarUpdatedAt) {
	public static PublicProfileResponse from(User user) {
		return new PublicProfileResponse(user.getId(), user.getUsername(), user.getDisplayName(),
				user.getAvatarUpdatedAt());
	}
}
