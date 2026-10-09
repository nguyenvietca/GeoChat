package com.geochat.chat.dto;

import java.time.Instant;
import java.util.List;

public class ChatDtos {
    public record OpenDirectChatResponse(
            Long conversationId,
            String type,
            UserSummaryResponse participant,
            Instant updatedAt
    ) {}

    public record ConversationListResponse(
            List<ConversationSummaryResponse> items
    ) {}

    public record ConversationSummaryResponse(
            Long conversationId,
            String type,
            UserSummaryResponse participant,
            Instant updatedAt,
            String lastMessage,
            Long lastMessageId,
            Instant lastMessageAt,
            String lastMessageSender,
            String groupName
    ) {}

    public record ConversationDetailResponse(
            Long conversationId,
            String type,
            List<UserSummaryResponse> participants,
            Instant createdAt,
            Instant updatedAt,
            Integer limitedMessagesRemaining
    ) {}

    public record MessageResponse(
            Long messageId,
            Long conversationId,
            Long senderId,
            String content,
            Instant createdAt
    ) {}

    public record MessageListResponse(
            List<MessageResponse> items,
            long total,
            int page,
            int size
    ) {}

    public record UserSummaryResponse(
            Long userId,
            String username,
            String displayName
    ) {}

    public record GroupInfoResponse(
            Long groupId,
            String name,
            UserSummaryResponse owner,
            int memberCount,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record GroupMembersResponse(
            List<GroupMemberResponse> items
    ) {}

    public record GroupMemberResponse(
            UserSummaryResponse user,
            String role,
            Instant joinedAt
    ) {}

        public record UserPresenceResponse(Long userId, boolean online) {}

        public record ConversationPresenceResponse(List<UserPresenceResponse> items) {}
}
