# Realtime

WebSocket endpoints connect clients to chat and notification flows through service-based handlers.

## Authentication

Connect to `/ws` and send the JWT as `Authorization: Bearer <token>` in the STOMP `CONNECT` headers. The server authenticates the STOMP session and authorizes subscriptions against that principal.

## Direct Chat

Direct chat messages are published to `/topic/chat/{conversationId}`. The server verifies conversation participation before allowing a subscription.

## Notifications

After a notification is persisted, the server sends its notification response to the recipient's `/user/queue/notifications` destination. Clients subscribe to that exact user destination; they must not put a user ID in the destination. The notification REST API remains the source of truth and supports `limit`/`offset` pagination (`limit` defaults to 20 and is capped at 50). Clients should refresh the unread count after reconnecting to recover events missed while offline.
