package com.geochat.chat.event;

public record WebSocketPresenceChangedEvent(Long userId, boolean online) {
}