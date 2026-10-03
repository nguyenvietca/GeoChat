package com.geochat.user.dto;

import java.util.List;

public record UserSearchResponse(
        List<UserSearchResult> items
) {
}
