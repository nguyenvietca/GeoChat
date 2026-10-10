# PROMPT_034 Preparation

This document separates the architecture confirmed in the repository from design proposals for the next milestone. Reply and reaction functionality is not implemented by PROMPT_033.

## Confirmed Current Architecture

- The JPA message entity is `backend/src/main/java/com/geochat/chat/entity/Message.java`. Its stable identifier is a generated `Long id`; it stores `conversationId`, `senderId`, `content`, and `createdAt`. It has no reply or reaction fields and no soft-delete field.
- Message REST contracts are in `backend/src/main/java/com/geochat/chat/dto/ChatDtos.java`. `MessageResponse` contains `messageId`, `conversationId`, `senderId`, `content`, and `createdAt`; `MessageListResponse` adds pagination metadata.
- REST message operations are in `backend/src/main/java/com/geochat/chat/controller/ChatController.java`: send at `POST /api/v1/chats/{conversationId}/messages`, list at `GET /api/v1/chats/{conversationId}/messages`, and read cursor at `POST /api/v1/chats/{conversationId}/read`.
- WebSocket sends are handled by `ChatWebSocketController`; persisted message events are broadcast on `/topic/chat/{conversationId}`. The current message event payload remains `MessageResponse`.
- Authorization is based on active conversation participation in `ChatService` and the STOMP inbound/outbound interceptors. Group membership changes affect access to the group conversation.
- Messages are queried newest-first by `createdAt` and `id`, then reversed for REST responses. Web merges by `messageId` and sorts with `compareMessageOrder` in `apps/web/src/features/chat/messagePresentation.ts`.
- Web message bubbles are rendered directly in `apps/web/src/features/chat/ChatPanel.tsx`. Each row uses `messageId` as its React key and retains sender, content, and timestamp presentation. There is not currently a separate reusable message-bubble component; the rendering boundary is small, so extraction is not needed yet.
- No message deletion endpoint or deletion state is present in the inspected entity, DTO, controller, or chat UI.
- Conversation type comes from conversation context, not `MessageResponse`. Preserve each row's `data-message-id`: read-cursor tracking uses that boundary if bubbles are extracted later.
- Deleting a group currently hard-deletes its messages and participants. There is no individual message edit/delete API; future reply references must account for group deletion separately.
- Typing uses `/app/chat/{conversationId}/typing` and `/topic/chat/{conversationId}/typing`, separately from persisted messages. Optional request `activityId` rejects stale activity within a session/conversation; server `eventId` lets Web reject out-of-order delivery. This is ephemeral ordering and is not a message or reaction version contract.

## Proposed Reply Design

- Add an optional nullable `replyToMessageId` reference only after agreeing on deletion semantics. Validate that the referenced message exists and belongs to the same conversation as the new message; reject cross-conversation references in the service, not only in the UI.
- Represent a reply preview as an optional compact DTO, such as original message ID, sender display name, and a bounded text excerpt. Do not require clients to fetch each referenced message separately.
- If the original message is missing or deleted, keep the reply itself readable and return an unavailable/deleted placeholder with no private content. If hard deletion is later selected, define how foreign-key behavior preserves or clears the reference before writing a migration.
- Keep all existing message fields and REST/WebSocket event shapes valid. Treat new reply fields as optional and audit Mobile JSON parsing before adding them; additive JSON is not automatically compatible with strict decoders.

## Proposed Reaction Design

- Associate each reaction with a message, user, and normalized supported emoji value. Enforce uniqueness for `(message_id, user_id, emoji)` in the database so retries and concurrent requests cannot create duplicates.
- Return reaction summaries grouped by emoji with counts and whether the current user reacted. Avoid returning one reaction row per user when a summary suffices.
- Publish reaction changes as a separate, versioned message-action event destination rather than changing the existing message payload. Define event IDs or versions so reconnects and duplicate delivery can be reconciled.
- Reuse conversation membership checks for reads and writes. Reject reactions to messages outside the authorized conversation and apply any future removal permissions consistently with message policy.

## Proposed Message Actions

- Reply: show a compact quoted preview and navigate/scroll to the referenced message when it is loaded; handle paginated or unavailable originals without blocking the composer.
- React: expose a restrained emoji picker and current reaction summaries, with keyboard and screen-reader support.
- Copy text: use the Clipboard API when available and expose a clear failure fallback.
- Show actions only when the message and current user permit them; do not render inactive placeholder buttons.

## Risks and Decisions for PROMPT_034

- API compatibility: inspect both Web and Mobile decoders before adding optional message fields; preserve the current required fields and message event destination.
- Database migrations: decide FK deletion behavior, indexes, reaction uniqueness, and any emoji normalization before migration authoring.
- Authorization: enforce same-conversation reply references and current membership at the service boundary; membership can change while a client is open.
- WebSocket ordering: message, reply-preview, and reaction events can arrive late or more than once; define IDs/versioning and client reconciliation.
- Pagination: referenced messages may not be in the current page. Reply previews must not depend on loading the entire history.
- Duplicate events: use stable message/action identifiers and database constraints to make retries idempotent.
- Performance: batch or aggregate reaction summaries; avoid per-message/per-user queries when loading conversation pages.
- Mobile compatibility: preserve the current message contract and review Mobile parsing before shared DTO changes. PROMPT_033 does not modify Mobile.
- Realtime deployment: current presence/session tracking is process-local. If backend instances are added, presence and typing will need shared coordination or explicit single-instance routing; Redis is not introduced by this milestone.
