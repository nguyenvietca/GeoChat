package com.geochat.chat.event;

// Persisted per-message version. No viewer-dependent or private user data is broadcast.
public record MessageReactionsChangedEvent(Long conversationId, Long messageId, long version) {}
