package com.geochat.chat.event;

import com.geochat.chat.dto.ChatDtos.GroupInfoResponse;
import com.geochat.chat.dto.ChatDtos.GroupMemberResponse;

public record GroupManagementEvent(
        String type,
        GroupInfoResponse group,
        GroupMemberResponse member
) {
}