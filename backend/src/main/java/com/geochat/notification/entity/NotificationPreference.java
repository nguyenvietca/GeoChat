package com.geochat.notification.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "notification_preferences")
public class NotificationPreference {
    @Id @Column(name = "user_id") private Long userId;
    @Column(name = "direct_alerts", nullable = false) private boolean directAlerts = true;
    @Column(name = "group_alerts", nullable = false) private boolean groupAlerts = true;
    @Column(name = "friend_request_alerts", nullable = false) private boolean friendRequestAlerts = true;
    @Column(name = "friend_acceptance_alerts", nullable = false) private boolean friendAcceptanceAlerts = true;
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public boolean isDirectAlerts() { return directAlerts; }
    public void setDirectAlerts(boolean value) { directAlerts = value; }
    public boolean isGroupAlerts() { return groupAlerts; }
    public void setGroupAlerts(boolean value) { groupAlerts = value; }
    public boolean isFriendRequestAlerts() { return friendRequestAlerts; }
    public void setFriendRequestAlerts(boolean value) { friendRequestAlerts = value; }
    public boolean isFriendAcceptanceAlerts() { return friendAcceptanceAlerts; }
    public void setFriendAcceptanceAlerts(boolean value) { friendAcceptanceAlerts = value; }
}
