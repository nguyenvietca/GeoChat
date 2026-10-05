package com.geochat.notification.dto;

import java.time.Instant;

public record PushDeviceResponse(Long deviceId, String platform, Instant createdAt) {
}