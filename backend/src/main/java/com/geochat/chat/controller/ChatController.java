package com.geochat.chat.controller;

import com.geochat.chat.dto.ChatDtos.ReadStateResponse;
import com.geochat.chat.dto.MarkConversationReadRequest;

import com.geochat.chat.dto.ChatDtos.ConversationDetailResponse;
import com.geochat.chat.dto.ChatDtos.ConversationListResponse;
import com.geochat.chat.dto.ChatDtos.ConversationPresenceResponse;
import com.geochat.chat.dto.ChatDtos.MessageListResponse;
import com.geochat.chat.dto.ChatDtos.MessageResponse;
import com.geochat.chat.dto.ChatDtos.OpenDirectChatResponse;
import com.geochat.chat.dto.OpenDirectChatRequest;
import com.geochat.chat.dto.OpenContextualChatRequest;
import com.geochat.chat.dto.SendMessageRequest;
import com.geochat.chat.service.ChatService;
import com.geochat.common.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import com.geochat.chat.dto.ChatDtos.MessageReactionState;
import com.geochat.chat.dto.ChatDtos.ReactionStatesResponse;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class ChatController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatController(ChatService chatService, SimpMessagingTemplate messagingTemplate) {
        this.chatService = chatService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/chats/direct")
    public ApiResponse<OpenDirectChatResponse> openDirectConversation(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody OpenDirectChatRequest request) {
        return ApiResponse.ok(chatService.openDirectConversation(principal.getUsername(), request));
    }

    @PostMapping("/chats/contextual")
    public ApiResponse<OpenDirectChatResponse> openContextualConversation(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody OpenContextualChatRequest request) {
        return ApiResponse.ok(chatService.openContextualConversation(principal.getUsername(), request));
    }

    @PostMapping("/chats/discovery")
    public ApiResponse<OpenDirectChatResponse> openDiscoveryConversation(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody OpenDirectChatRequest request) {
        return ApiResponse.ok(chatService.openDiscoveryConversation(principal.getUsername(), request));
    }

    @GetMapping("/chats")
    public ApiResponse<ConversationListResponse> listConversations(@AuthenticationPrincipal UserDetails principal) {
        return ApiResponse.ok(chatService.listConversations(principal.getUsername()));
    }

    @GetMapping("/chats/{conversationId}")
    public ApiResponse<ConversationDetailResponse> getConversationDetail(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable Long conversationId) {
        return ApiResponse.ok(chatService.getConversationDetail(principal.getUsername(), conversationId));
    }

    @GetMapping("/chats/{conversationId}/presence")
    public ApiResponse<ConversationPresenceResponse> getConversationPresence(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable Long conversationId) {
        return ApiResponse.ok(chatService.getConversationPresence(principal.getUsername(), conversationId));
    }

    @PostMapping("/chats/{conversationId}/messages")
    public ApiResponse<MessageResponse> sendMessage(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable Long conversationId,
            @Valid @RequestBody SendMessageRequest request) {
        MessageResponse message = chatService.sendMessage(principal.getUsername(), conversationId, request);
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, message);
        return ApiResponse.ok(message);
    }

    @PostMapping("/chats/{conversationId}/read")
    public ApiResponse<ReadStateResponse> markConversationRead(
            @AuthenticationPrincipal UserDetails principal, @PathVariable Long conversationId,
            @Valid @RequestBody MarkConversationReadRequest request) {
        return ApiResponse.ok(chatService.markConversationRead(principal.getUsername(), conversationId, request.messageId()));
    }

    @PutMapping("/chats/{conversationId}/messages/{messageId}/reactions/{key}")
    public ApiResponse<MessageReactionState> addReaction(@AuthenticationPrincipal UserDetails principal,
            @PathVariable Long conversationId, @PathVariable Long messageId, @PathVariable String key) {
        return ApiResponse.ok(chatService.setReaction(principal.getUsername(), conversationId, messageId, key, true));
    }

    @DeleteMapping("/chats/{conversationId}/messages/{messageId}/reactions/{key}")
    public ApiResponse<MessageReactionState> removeReaction(@AuthenticationPrincipal UserDetails principal,
            @PathVariable Long conversationId, @PathVariable Long messageId, @PathVariable String key) {
        return ApiResponse.ok(chatService.setReaction(principal.getUsername(), conversationId, messageId, key, false));
    }

    @GetMapping("/chats/{conversationId}/reactions")
    public ApiResponse<ReactionStatesResponse> getReactions(@AuthenticationPrincipal UserDetails principal,
            @PathVariable Long conversationId, @RequestParam List<Long> messageIds) {
        return ApiResponse.ok(chatService.getReactionStates(principal.getUsername(), conversationId, messageIds));
    }

    @GetMapping("/chats/{conversationId}/messages")
    public ApiResponse<MessageListResponse> listMessages(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer page) {
        return ApiResponse.ok(chatService.listMessages(principal.getUsername(), conversationId, limit, page));
    }
}
