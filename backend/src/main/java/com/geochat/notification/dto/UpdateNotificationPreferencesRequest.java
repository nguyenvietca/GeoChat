package com.geochat.notification.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateNotificationPreferencesRequest(@NotNull Boolean directAlerts, @NotNull Boolean groupAlerts,
        @NotNull Boolean friendRequestAlerts, @NotNull Boolean friendAcceptanceAlerts) {}
