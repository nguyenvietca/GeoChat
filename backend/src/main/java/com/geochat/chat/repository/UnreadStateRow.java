package com.geochat.chat.repository;

public interface UnreadStateRow {
    Long getConversationId();
    Long getUserId();
    long getUnreadCount();
    long getReadStateVersion();
    java.time.Instant getReadStateSince();
}
