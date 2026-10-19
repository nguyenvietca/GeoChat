package com.geochat.user.controller;

import com.geochat.common.response.ApiResponse;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.AccountLifecycleService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUsersController {
    private final UserRepository users;
    private final AccountLifecycleService accounts;
    private final com.geochat.chat.service.ChatService chats;
    public AdminUsersController(UserRepository users, AccountLifecycleService accounts, com.geochat.chat.service.ChatService chats) {
        this.users = users; this.accounts = accounts; this.chats = chats;
    }
    public record Item(Long id, String username, String displayName, String status, String role, String blockReason) {
        static Item from(User u) { return new Item(u.getId(), u.getUsername(), u.getDisplayName(),
                u.getStatus().name(), u.getRole().name(), u.getBlockReason()); }
    }
    public record Result(List<Item> items, boolean hasMore) {}
    public record Decision(@NotBlank(message = "Enter a reason between 1 and 500 characters.")
                           @Size(max = 500, message = "Enter a reason between 1 and 500 characters.") String reason) {}

    @GetMapping
    public ApiResponse<Result> list(@RequestParam(defaultValue = "") String query,
                                    @RequestParam(defaultValue = "0") int page,
                                    jakarta.servlet.http.HttpServletResponse response) {
        if (query.length() > 100 || page < 0 || page > 10000) throw new IllegalArgumentException("Invalid search parameters.");
        var result = users.adminSearch(query.strip(), PageRequest.of(page, 20));
        response.setHeader("Cache-Control", "no-store");
        return ApiResponse.ok(new Result(result.map(Item::from).getContent(), result.hasNext()));
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
