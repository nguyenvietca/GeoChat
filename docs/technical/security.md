# Security

- JWT-based authentication
- Authorization from authenticated security context
- No client-controlled userId trust
- Server-side ownership and membership validation
- Group management changes are sent to authorized users through `/user/queue/group-events`; existing chat-topic subscriptions are revalidated on each outbound delivery after a membership change.
- Presence snapshots and `/topic/presence/{userId}` subscriptions require a shared direct conversation; status events are sent only to subscribers authorized by that rule.
- Non-friend contextual chats require a server-verified nearby location or shared-group membership and are limited to five total messages.
