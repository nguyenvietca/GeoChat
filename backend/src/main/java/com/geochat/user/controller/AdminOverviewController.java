package com.geochat.user.controller;

import com.geochat.chat.websocket.WebSocketSessionRegistry;
import com.geochat.common.response.ApiResponse;
import com.geochat.user.entity.UserStatus;
import com.geochat.user.repository.UserRepository;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminOverviewController {
    private final UserRepository users;
    private final WebSocketSessionRegistry sessions;
    public AdminOverviewController(UserRepository users, WebSocketSessionRegistry sessions) {
        this.users = users; this.sessions = sessions;
    }
    public record Overview(long total, long active, long inactive, long blocked, long online, Instant measuredAt) {}
    @GetMapping("/overview")
    public ApiResponse<Overview> overview(jakarta.servlet.http.HttpServletResponse response) {
        var online = sessions.onlineUserIds();
        response.setHeader("Cache-Control", "no-store");
        return ApiResponse.ok(new Overview(users.count(), users.countByStatus(UserStatus.ACTIVE),
                users.countByStatus(UserStatus.INACTIVE), users.countByStatus(UserStatus.LOCKED),
                online.isEmpty() ? 0 : users.countByStatusAndIdIn(UserStatus.ACTIVE, online), Instant.now()));
    }
}
