package com.geochat.user.dto;

import java.time.Instant;

import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;

public record UserResponse(Long id, String username, String displayName, String email, String phoneNumber,
		Instant avatarUpdatedAt, UserStatus status, Instant createdAt, Instant updatedAt) {
	public static UserResponse from(User user) {
		return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getEmail(),
				user.getPhoneNumber(), user.getAvatarUpdatedAt(), user.getStatus(), user.getCreatedAt(),
				user.getUpdatedAt());
	}
}
