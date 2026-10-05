package com.geochat.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterPushDeviceRequest(
		@NotBlank(message = "Push token is required") @Size(max = 512, message = "Push token is too long") String token,

		@NotBlank(message = "Platform is required") @Pattern(regexp = "ios|android", message = "Platform must be ios or android") String platform) {
}