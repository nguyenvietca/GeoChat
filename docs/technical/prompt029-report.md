# PROMPT_029 implementation and validation

## Implementation

- Search filters loaded direct participant names and group names locally, ignoring case and surrounding whitespace. Clear search and no-match states are accessible; search leaves the current chat selected. Friends without a conversation can still start one.
- Direct and group conversations share one activity-sorted list. Actual latest-message time takes precedence over conversation metadata time, with conversation ID as a deterministic tie-breaker. Empty and owner-only groups remain visible.
- Summaries supply text previews, stable latest-message ID, timestamp, sender display name and group name. Group previews prefix the sender when known; React escapes text and CSS truncates previews and names. No histories are downloaded for list previews.
- List dates show localized time today, Yesterday, or a short localized date (including the year for previous years). Invalid/missing dates render safely. Bubbles use the same localized time utility and preserve sender names and incoming/outgoing styling.
- An immediate ref guards duplicate sends before React rerenders. Sending disables Send; failed requests preserve drafts and explain uncertain persistence. Check recent messages retrieves only the latest history page without resending or clearing the draft. Retry remains an explicit user send; no automatic retry/offline queue is added. REST and socket results deduplicate by backend message ID.
- Initial history scrolls to the newest message; subsequent incoming messages scroll smoothly when near the bottom. Readers above the bottom keep their position and get Jump to latest. Prepending older history preserves the visible position, measuring immediately before insertion so messages arriving during the request cannot consume an outdated scroll snapshot.
- One authenticated account subscription to /user/queue/conversation-activity updates relevant previews and ordering, including unselected conversations. Unknown conversation activity requests only that conversation's authorized details; concurrent activity shares the request and retains its latest preview. The selected conversation continues using the existing topic. Connections remain shared by token and subscriptions clean up on switch/logout.
- Reconnect reconciles the list once through the existing group-event subscription and fetches the selected chat's latest history page (and selected group details). Switching selection never reloads friends or all conversations. Stable navigation refs, titleHint, keyed panels, stale-response guards, scrollbar gutters and the existing 40/60 responsive layout remain. Group deletion/removal prevents delayed activity from restoring unavailable entries.
- Small CSS changes retain readable list dates at narrow widths, improve bubble time size and style search/jump controls. No new dependencies were added.

## Backend compatibility and efficiency

GET /api/v1/chats preserves existing fields and their meanings, adding nullable lastMessageId, lastMessageAt, lastMessageSender and groupName. Direct/contextual open responses add updatedAt so the Web uses a server timestamp even before the first message. Existing message response and history pagination contracts are unchanged. No database migration or shared-package change was needed.

Conversation summaries batch conversations (including owners), participants, latest messages and users, with membership filtering before queries. The existing latest-message query breaks identical timestamps by message ID. Legacy direct-chat duplicate selection and owner-only group visibility are preserved.

ConversationActivityEvent is published by the shared send service and delivered after transaction commit to current participants' authenticated user queues, including the sender. Existing topic broadcasts, notifications and group-management events remain. The STOMP interceptor permits only the authenticated user's activity destination; arbitrary destination sends remain rejected.

## Files changed

Web implementation:
- apps/web/src/features/chat/MessagesPage.tsx
- apps/web/src/features/chat/ChatPanel.tsx
- apps/web/src/features/chat/messagePresentation.ts (new)
- apps/web/src/services/chatWebSocket.ts
- apps/web/src/types/index.ts
- apps/web/src/styles.css

Web tests:
- apps/web/src/features/chat/MessagesPage.test.tsx
- apps/web/src/features/chat/messagePresentation.test.ts (new)
- apps/web/src/services/chatWebSocket.test.ts
- apps/web/src/features/friends/FriendsChat.test.tsx
- apps/web/src/App.test.tsx (new subscription mock)

Backend implementation:
- backend/src/main/java/com/geochat/chat/dto/ChatDtos.java
- backend/src/main/java/com/geochat/chat/service/ChatService.java
- backend/src/main/java/com/geochat/chat/repository/ConversationRepository.java
- backend/src/main/java/com/geochat/chat/repository/ConversationParticipantRepository.java
- backend/src/main/java/com/geochat/chat/event/ConversationActivityEvent.java (new)
- backend/src/main/java/com/geochat/chat/websocket/ConversationActivityEventListener.java (new)
- backend/src/main/java/com/geochat/chat/websocket/StompAuthenticationChannelInterceptor.java

Backend tests:
- backend/src/test/java/com/geochat/chat/ChatIntegrationTest.java
- backend/src/test/java/com/geochat/chat/ChatWebSocketIntegrationTest.java

This report: docs/technical/prompt029-report.md. The pre-existing untracked AI_promt/prompt_029.md was read and preserved.

## Actual validation

- Web: npm.cmd run build passed (tsc -b and Vite production build).
- Web: npm.cmd test -- --reporter=dot passed: 96 tests in 13 files, zero failures.
- Backend: Maven Wrapper test with JAVA_HOME=C:/Program Files/Java/jdk-21 passed: 77 tests, zero failures/errors/skips.
- Backend additions cover latest-message ties and sender/time, empty owner-only groups, mixed direct/group activity order, unauthorized filtering, old response fields, authenticated activity delivery with three accounts, removal revocation and batch query count (8 groups, at most 6 SQL statements).
- Web additions cover search/clear/empty matches, mixed sorting, owner-only placeholders, safe escaped previews, realtime updates/deduplication, dates, pending sends and failed draft retry/recent-history checking, near-bottom scrolling, preservation while reading and prepending, reconnect, unknown conversation discovery and late-response switching. Existing group management/deletion and subscription cleanup tests continue to run.
- No separate lint or typecheck scripts exist; TypeScript validation runs in build.
- git diff --check passed.
- Initial PowerShell npm.ps1 signing restriction was resolved using npm.cmd. Maven initially lacked JAVA_HOME and sandbox access to its cache; Java 21 was located and the approved Maven command used the existing cache outside the sandbox.

## Verification limits and remaining work

No interactive browser verification with two or three accounts was performed: this session has no browser automation tool. Scenarios A?E are covered in automated component/server tests where feasible, but rendered responsive layout, real browser scroll physics, header/layout shifts and the full interactive regression checklist still need browser verification. JSDOM scroll tests use controlled geometry and do not replace those visual checks. Backend integration tests use the repository's H2 test profile; the new query was not run against production PostgreSQL/PostGIS.

Ambiguous network failures cannot guarantee an exactly-once retry because the backend has no client idempotency key. The UI preserves the draft, warns about possible persistence and provides recent-history checking; it never retries automatically. REST topic and account activity notifications intentionally coexist and are deduplicated locally.

Mobile source was not modified. No Mobile builds, typechecks or tests were run. Physical-device checks were skipped because no real device is available.

The implementation and automated validation are complete; the requested interactive browser/manual acceptance scenarios remain unverified. Overall status: PROMPT_029 NOT COMPLETE.


## Follow-up: Search/Nearby pre-friendship chat and send quota

The user explicitly requested messaging any user returned by Search. Search now provides Message independently of friendship actions, using the additive authenticated POST /api/v1/chats/discovery endpoint with { userId }. This reuses the existing limited conversation and participant authorization without requiring location or a shared group. Friends continue through the existing unlimited direct-chat flow; contextual chat keeps its current nearby/group checks for existing clients.

Nearby now captures the radius returned with its displayed results and uses that radius when opening a non-friend chat. Changing the selector before refreshing results cannot accidentally apply a smaller radius to those existing results.

The pessimistic conversation lock was incorrectly in the read-only history method. It now covers the limited send quota check and insertion in the shared transactional REST/STOMP send path. Each participant can send five messages independently before friendship. Concurrent sends cannot both consume the final slot. Existing limited chats become unrestricted after friendship acceptance without requiring a separate Friends-page open action.

The composer now also guards Enter submission when quota is zero, and refreshes remaining quota after a rejected send so another tab/account consuming the final slot disables sending while retaining the draft.

Additional files changed: apps/web/src/features/search/SearchPage.tsx, apps/web/src/features/nearby/NearbyPage.tsx, apps/web/src/api/chats.ts, apps/web/src/api/chats.test.ts, backend/src/main/java/com/geochat/chat/controller/ChatController.java and docs/product/business-rules.md. Existing chat implementation/tests and this report were extended.

Follow-up validation: Web build/typecheck passed; 101 Web tests passed; 79 Backend tests passed; git diff --check passed. New tests cover Search non-friend entry, Nearby result-radius consistency, zero-quota keyboard guards, exhausted-quota synchronization, the discovery API authorization/self/missing-user checks, concurrent REST/STOMP quota enforcement and automatic friendship unlocking. Mobile remained untouched. The interactive browser limitations above still apply.


## Follow-up correction: five messages per sender

The user clarified that the quota is independent for each participant. The backend now counts messages by conversation ID and authenticated sender ID for both remaining allowance and send validation. The existing transactional conversation lock still prevents concurrent REST/STOMP requests from exceeding one sender's quota. History totals and pagination remain based on all messages.

The Web decrements the local allowance only for messages sent by the current user; received messages and duplicate socket frames do not consume that allowance. Tests verify one participant can send five messages while the other retains all five, ten messages total are accepted, each sixth send is rejected, and friendship removes the restriction. Mobile was not modified.

Validation after the per-sender correction: Web build/typecheck passed; all 102 Web tests and 79 Backend tests passed; git diff --check passed. No database migration was needed.


## Follow-up: accept friendship within limited chats

LimitedChatFriendship.tsx adds friendship controls alongside the remaining-message notice. It uses the existing incoming/outgoing request APIs to select Add friend, Accept friend request or a waiting state. These controls remain available when the composer reaches zero allowance. Successful acceptance enables sending immediately, clears old send errors and preserves the draft; failed acceptance retains the limit and provides a refresh action. Pending outgoing requests do not unlock messaging.

The sender observes acceptance through the existing NotificationContext, rechecking only the selected conversation's authorized detail. Focus and Refresh friendship also reconcile changes made in another tab or missed while disconnected. No new socket subscription, polling, backend endpoint or database change is needed. Async responses are ignored after the chat unmounts, and a ref prevents duplicate friendship submissions.

Files added: apps/web/src/features/chat/LimitedChatFriendship.tsx and LimitedChatFriendship.test.tsx. ChatPanel.tsx, MessagesPage.test.tsx, styles.css, business-rules.md and this report were updated. Added tests cover acceptance unlocking and draft preservation, pending requests, failed acceptance, realtime acceptance notifications and stale responses after switching away. Backend and Mobile code were not changed for this follow-up.

Validation for the in-chat friendship controls: Web build/typecheck passed; all 107 tests across 14 files passed; git diff --check passed. No Backend validation rerun was required because this follow-up changed only Web and documentation. Interactive browser verification for the new controls was not performed.
