package com.geochat.user.controller;

import com.geochat.common.response.ApiResponse;
import com.geochat.user.service.AccountLifecycleService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUsersController {
    private final AccountLifecycleService accounts;
    private final com.geochat.chat.service.ChatService chats;
    public AdminUsersController(AccountLifecycleService accounts, com.geochat.chat.service.ChatService chats, com.geochat.user.service.AdminQueries queries) {
        this.queries = queries; this.accounts = accounts; this.chats = chats;
    }
    public record Decision(@NotBlank(message = "Enter a reason between 1 and 500 characters.")
                           @Size(max = 500, message = "Enter a reason between 1 and 500 characters.") String reason) {}

    private final com.geochat.user.service.AdminQueries queries;
    @GetMapping
    public ApiResponse<com.geochat.user.service.AdminQueries.Page<com.geochat.user.service.AdminQueries.Item>> list(
            @RequestParam(defaultValue="") String query, @RequestParam(required=false) String status,
            @RequestParam(required=false) String provider, @RequestParam(required=false) java.time.Instant after,
            @RequestParam(required=false) java.time.Instant before, @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size, jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");
        return ApiResponse.ok(queries.users(query,status,provider,after,before,page,size));
    }
    @GetMapping("/{id}")
    public ApiResponse<com.geochat.user.service.AdminQueries.Detail> detail(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store"); return ApiResponse.ok(queries.detail(id));
    }
    @PostMapping("/{id}/suspend")
    public ApiResponse<Void> suspend(@PathVariable Long id, @Valid @RequestBody Decision decision, Authentication auth) {
        accounts.moderate(auth.getName(),id,true,decision.reason());return ApiResponse.ok(null);
    }
    @PostMapping("/{id}/reactivate")
    public ApiResponse<Void> reactivate(@PathVariable Long id, @Valid @RequestBody Decision decision, Authentication auth) {
        accounts.moderate(auth.getName(),id,false,decision.reason());return ApiResponse.ok(null);
    }
    @PostMapping("/{id}/block")
    public ApiResponse<Void> block(@PathVariable Long id, @Valid @RequestBody Decision decision, Authentication auth) {
        accounts.moderate(auth.getName(), id, true, decision.reason());
        return ApiResponse.ok(null);
    }
    @PostMapping("/{id}/unblock")
    public ApiResponse<Void> unblock(@PathVariable Long id, @Valid @RequestBody Decision decision, Authentication auth) {
        accounts.moderate(auth.getName(), id, false, decision.reason());
        return ApiResponse.ok(null);
    }

    @PostMapping("/{id}/conversation")
    public ApiResponse<com.geochat.chat.dto.ChatDtos.OpenDirectChatResponse> conversation(@PathVariable Long id,
            Authentication auth) {
        return ApiResponse.ok(chats.openSuperAdminConversation(auth.getName(), id));
    }

}
