package com.geochat.chat.event;

import com.geochat.chat.dto.ChatDtos.ReadStateResponse;

public record ConversationReadEvent(String username, ReadStateResponse state) {}
