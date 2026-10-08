# Realtime

WebSocket endpoints connect clients to chat and notification flows through service-based handlers.

## Authentication

Connect to `/ws` and send the JWT as `Authorization: Bearer <token>` in the STOMP `CONNECT` headers. The server authenticates the STOMP session and authorizes subscriptions against that principal.

## Conversations

Direct and group messages use `/app/chat/{conversationId}/send` and are published to `/topic/chat/{conversationId}`. REST and STOMP sends persist the message before broadcasting it. The server verifies conversation participation before allowing a subscription or send, and a removed group member loses access immediately.

Group conversations are created with `POST /api/v1/groups` using a name and optional initial member IDs. The authenticated creator becomes `OWNER`; initial members must already be friends with that creator. `GET /api/v1/groups/{groupId}` and `GET /api/v1/groups/{groupId}/members` are member-only. A non-owner leaves with `DELETE /api/v1/groups/{groupId}/members/me`; owners cannot leave until ownership transfer exists. Group messages do not currently generate notification or push events; direct-chat notification behavior is unchanged.

## Notifications

After a notification is persisted, the server sends its notification response to the recipient's `/user/queue/notifications` destination. Clients subscribe to that exact user destination; they must not put a user ID in the destination. The notification REST API remains the source of truth and supports `limit`/`offset` pagination (`limit` defaults to 20 and is capped at 50). Clients should refresh the unread count after reconnecting to recover events missed while offline.
