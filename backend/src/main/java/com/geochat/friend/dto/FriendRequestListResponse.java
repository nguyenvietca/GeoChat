package com.geochat.friend.dto;

import java.util.List;

public record FriendRequestListResponse(
        List<FriendRequestItemResponse> items
) {
}
