package com.geochat.notification.controller;

import com.geochat.common.response.ApiResponse;
import com.geochat.notification.dto.NotificationListResponse;
import com.geochat.notification.dto.NotificationResponse;
import com.geochat.notification.dto.UnreadCountResponse;
import com.geochat.notification.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/notifications")
    public ApiResponse<NotificationListResponse> getNotifications(@AuthenticationPrincipal UserDetails principal) {
        return ApiResponse.ok(notificationService.listNotifications(principal.getUsername()));
    }

    @GetMapping("/notifications/unread-count")
    public ApiResponse<UnreadCountResponse> getUnreadCount(@AuthenticationPrincipal UserDetails principal) {
        return ApiResponse.ok(notificationService.getUnreadCount(principal.getUsername()));
    }

    @PostMapping("/notifications/{notificationId}/read")
    public ApiResponse<NotificationResponse> markAsRead(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable Long notificationId) {
        return ApiResponse.ok(notificationService.markAsRead(principal.getUsername(), notificationId));
    }

    @PostMapping("/notifications/read-all")
    public ApiResponse<NotificationListResponse> markAllAsRead(@AuthenticationPrincipal UserDetails principal) {
        return ApiResponse.ok(notificationService.markAllAsRead(principal.getUsername()));
    }
}
