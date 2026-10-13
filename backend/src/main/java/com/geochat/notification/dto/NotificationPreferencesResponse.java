package com.geochat.notification.dto;

public record NotificationPreferencesResponse(boolean directAlerts, boolean groupAlerts,
        boolean friendRequestAlerts, boolean friendAcceptanceAlerts) {
    public boolean alertsEnabledForMessage(String conversationType) {
        return "GROUP".equals(conversationType) ? groupAlerts : directAlerts;
    }
}
