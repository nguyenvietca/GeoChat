package com.geochat.friend.dto;

import java.util.List;

public record FriendListResponse(
        List<FriendSummaryResponse> items
) {
}
