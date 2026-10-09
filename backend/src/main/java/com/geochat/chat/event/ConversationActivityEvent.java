package com.geochat.chat.event;

import com.geochat.chat.dto.ChatDtos.MessageResponse;

public record ConversationActivityEvent(MessageResponse message, String senderDisplayName) {}
