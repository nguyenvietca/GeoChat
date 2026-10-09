# Realtime

WebSocket endpoints connect clients to chat and notification flows through service-based handlers.

## Authentication

Connect to `/ws` and send the JWT as `Authorization: Bearer <token>` in the STOMP `CONNECT` headers. The server authenticates the STOMP session and authorizes subscriptions against that principal.

## Conversations

Direct and group messages use `/app/chat/{conversationId}/send` and are published to `/topic/chat/{conversationId}`. REST and STOMP sends persist the message before broadcasting it. The server verifies conversation participation before allowing a subscription or send, and a removed group member loses access immediately.

Group conversations are created with `POST /api/v1/groups` using a name and optional initial member IDs. The authenticated creator becomes `OWNER`; initial members must already be friends with that creator. `GET /api/v1/groups/{groupId}` and `GET /api/v1/groups/{groupId}/members` are member-only. A non-owner leaves with `DELETE /api/v1/groups/{groupId}/members/me`; owners cannot leave until ownership transfer exists. Group messages do not currently generate notification or push events; direct-chat notification behavior is unchanged.

Group management uses the existing REST API: owners rename with `PATCH /api/v1/groups/{groupId}` and `{ "name": "New name" }`, add friends with `POST /api/v1/groups/{groupId}/members`, and remove a member with `DELETE /api/v1/groups/{groupId}/members/{memberId}`. Group names are trimmed and limited to 100 characters. Membership writes lock the conversation row so concurrent additions cannot exceed `app.chat.max-group-members`; the participant composite key prevents duplicate membership.

After a committed rename or membership change, each current member receives a `GroupManagementEvent` on `/user/queue/group-events`. The JSON fields are `type` (`GROUP_RENAMED`, `MEMBER_ADDED`, `MEMBER_REMOVED`, or `MEMBER_LEFT`), `group` (the current `GroupInfoResponse`), and `member` (the affected `GroupMemberResponse`, or `null` for rename). A removed or departing member receives only their own removal event in addition to current members. Chat-topic deliveries recheck membership per connected session, so a removed member with an old subscription cannot receive later group messages; REST reads/sends and new STOMP subscriptions remain member-checked.

`POST /api/v1/chats/contextual` opens a friend conversation normally, or a limited direct conversation when the users are currently within the supplied `radiusMeters` or share a group. The server checks saved coordinates and group membership; callers cannot grant themselves access by choosing an arbitrary target. Limited conversations keep type `DIRECT` for client compatibility and allow five messages total across REST and STOMP. `ConversationDetailResponse.limitedMessagesRemaining` reports the remaining count; a database row lock serializes sends at the limit.

`GET /api/v1/chats/{conversationId}/presence` returns an authorized conversation's current participant presence. Direct conversation participants may subscribe to `/topic/presence/{userId}`. The server publishes `UserPresenceResponse` (`userId`, `online`) when the user's first WebSocket session connects and last session disconnects; the Web client shows the counterpart's presence rather than its own socket connection state.

## Notifications

After a notification is persisted, the server sends its notification response to the recipient's `/user/queue/notifications` destination. Clients subscribe to that exact user destination; they must not put a user ID in the destination. The notification REST API remains the source of truth and supports `limit`/`offset` pagination (`limit` defaults to 20 and is capped at 50). Clients should refresh the unread count after reconnecting to recover events missed while offline.
