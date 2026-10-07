package com.geochat.notification.controller;

import com.geochat.common.response.ApiResponse;
import com.geochat.notification.dto.NotificationListResponse;
import com.geochat.notification.dto.NotificationResponse;
import com.geochat.notification.dto.PushDeviceResponse;
import com.geochat.notification.dto.RegisterPushDeviceRequest;
import com.geochat.notification.dto.UnreadCountResponse;
import com.geochat.notification.service.PushDeviceService;
import com.geochat.notification.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/v1")
public class NotificationController {

    private final NotificationService notificationService;
    private final PushDeviceService pushDeviceService;

    public NotificationController(NotificationService notificationService, PushDeviceService pushDeviceService) {
        this.notificationService = notificationService;
        this.pushDeviceService = pushDeviceService;
    }

    @GetMapping("/notifications")
    public ApiResponse<NotificationListResponse> getNotifications(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit,
            @RequestParam(defaultValue = "0") @Min(0) int offset) {
        return ApiResponse.ok(notificationService.listNotifications(principal.getUsername(), limit, offset));
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

    @PostMapping("/notifications/devices")
    public ApiResponse<PushDeviceResponse> registerDevice(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody RegisterPushDeviceRequest request) {
        return ApiResponse.ok(pushDeviceService.register(principal.getUsername(), request));
    }

    @DeleteMapping("/notifications/devices/{deviceId}")
    public ApiResponse<Void> removeDevice(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable Long deviceId) {
        pushDeviceService.deactivate(principal.getUsername(), deviceId);
        return ApiResponse.ok(null);
    }
}
