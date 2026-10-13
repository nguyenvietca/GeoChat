package com.geochat.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateMyProfileRequest(
		@NotBlank(message = "Display name is required") @Size(min = 2, max = 100, message = "Display name must be between 2 and 100 characters") String displayName,
		@Email(message = "Email must be valid") @Size(max = 320, message = "Email must be at most 320 characters") String email,
		@Size(max = 32, message = "Phone number must be at most 32 characters") String phoneNumber) {
}
