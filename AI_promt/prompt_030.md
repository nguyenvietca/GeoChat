# PROMPT_030 — GeoChat Web Unread Messages & Read State

## 1. Project Context

GeoChat is a location-based social chat application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL, PostGIS, Flyway.
- Security: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Existing codebase, currently on hold.

Previously implemented:
- Authentication.
- Friend management.
- DIRECT messaging.
- GROUP messaging.
- Group management.
- Conversation synchronization.
- Conversation search and sorting.
- Latest-message previews.
- Message timestamps.
- Message sending feedback.
- Smart scrolling.
- Realtime conversation updates.
- Responsive Messages layout.

PROMPT_028 fixed important conversation switching, group management, and layout stability issues.

PROMPT_029 focused on Web messaging UX enhancements.

Preserve all existing functionality.

## 2. Development Rules

### Web — Primary Priority

Focus on:
- UI/UX.
- Responsive behavior.
- Unread message indicators.
- Conversation filtering.
- Realtime unread updates.
- Reliable read-state behavior.

### Backend — Only When Necessary

Implement the minimum backend support required for reliable unread tracking.

Prefer existing APIs, models, and WebSocket infrastructure.

Preserve backward compatibility with existing Mobile API consumers whenever reasonable.

### Mobile — Strictly Excluded

- Do not implement Mobile UI.
- Do not add Mobile features.
- Do not modify Mobile code.
- Do not run Mobile builds.
- Do not run Mobile typechecks.
- Do not run Mobile tests.

Do not delete or break existing Mobile code.

### Testing

Focus on Backend and Web, including regression testing.

## 3. Inspect Before Coding

Before implementing anything, inspect:

1. Existing MessagesPage and conversation components.
2. Current DIRECT and GROUP message entities.
3. Existing conversation summary DTOs.
4. Existing message pagination APIs.
5. Existing WebSocket/STOMP events.
6. Current notification implementation.
7. Existing database migrations.
8. Existing message ordering and timestamp fields.
9. Existing authentication and authorization rules.
10. Existing Backend and Web tests.

Determine whether unread tracking or read-state infrastructure already exists.

If it exists, reuse or extend it rather than implementing a duplicate system.

Briefly report:
- What already exists.
- What is missing.
- Which files need changes.
- Whether a database migration is necessary.
- How backward compatibility will be preserved.

Then proceed with implementation.

## 4. Feature: Unread Message Count

Each conversation should expose the number of messages not yet read by the current user.

Supported conversation types:
- DIRECT.
- GROUP.

Expected behavior:

- Incoming messages increase the unread count when not yet read.
- Messages sent by the current user do not increase their own unread count.
- Opening and actually viewing a conversation allows its unread messages to be marked as read.
- Unread counts remain correct after page refresh.
- Unread counts remain correct after reconnecting WebSocket.
- Unread counts are calculated independently for each user.
- Empty conversations have zero unread messages.

Do not implement unread tracking using frontend-only localStorage.

Backend must remain the authoritative source of persisted read state.

## 5. Backend Read-State Design

Inspect the existing database schema before choosing an implementation.

Prefer a lightweight per-user, per-conversation read cursor when compatible with the existing message model.

For example, the system may track:

- User ID.
- Conversation type.
- Conversation ID.
- Last read message ID or an equivalent stable cursor.

Use the existing ordering semantics.

Important:
- Do not assume UUIDs or arbitrary message IDs are chronologically sortable.
- Do not rely only on client timestamps.
- Avoid using timestamp comparisons without handling ties.
- Ensure read cursors never move backward.
- Ensure the cursor cannot point to messages outside the authorized conversation.

If DIRECT and GROUP messages have different persistence models, implement a simple compatible solution rather than forcing a large schema refactor.

Do not create redundant tables if existing membership or read-state tables already support this feature.

Use Flyway for any required schema migration.

Never edit an already-applied Flyway migration.

## 6. Backend API Requirements

Prefer extending the existing conversation summary response with optional backward-compatible fields such as:

- unreadCount
- hasUnread

These are examples, not mandatory field names.

Follow the existing DTO naming conventions.

Requirements:
- Existing response fields remain unchanged.
- Existing endpoints continue working.
- Existing Mobile clients are not required to send new fields.
- Unread count is calculated only for authorized conversations.
- Group membership and DIRECT participant checks remain enforced.
- Avoid N+1 queries.
- Avoid loading full message histories to count unread messages.

Provide an authenticated operation for marking a conversation as read if an equivalent API does not already exist.

Use existing route conventions.

The read operation should:
- Identify the authenticated user from security context.
- Validate conversation access.
- Accept or derive a valid read cursor.
- Be idempotent.
- Never move the cursor backward.
- Never mark future or unseen messages as read.
- Reject unauthorized access.
- Handle deleted conversations safely.

Do not trust arbitrary user IDs supplied by the client.

Do not change existing message-send contracts unnecessarily.

## 7. Web Conversation List UI

Improve the existing conversation sidebar.

For unread conversations:
- Show a small unread count badge.
- Make the conversation name or preview visually distinct.
- Preserve the latest-message preview.
- Preserve the latest-message timestamp.
- Keep the existing conversation ordering.

Recommended badge formatting:
- 1 through 99: display the count.
- 100 or more: display 99+.

For read conversations:
- Hide the unread badge.
- Use the normal visual appearance.

For empty conversations:
- Do not show an unread badge.

For UX/UI
- Sidebar ổn định, tin nhắn dễ đọc, ô nhập luôn nằm đúng vị trí và chuyển hội thoại mượt.

Use the existing GeoChat design conventions.

Do not redesign the entire Messages page.

## 8. All / Unread Filter

Add a lightweight conversation filter near the existing conversation search.

Options:
- All.
- Unread.

Expected behavior:

All:
- Display every available conversation.

Unread:
- Display conversations with unreadCount greater than zero.

Requirements:
- Work with DIRECT and GROUP conversations.
- Preserve the existing search query.
- Preserve sorting by latest-message activity.
- Do not trigger a full backend refetch when switching filters.
- Display an appropriate empty state.
- Keep the currently selected conversation stable.

If a conversation becomes read while the Unread filter is active, it may disappear from the filtered list, but the active conversation must remain usable.

Do not navigate away unexpectedly.

Use accessible controls with clear active states.

## 9. Mark Conversation as Read

Marking a conversation as read must reflect actual user interaction.

Expected behavior:
- The conversation is selected.
- Relevant messages have loaded.
- The document is visible and the user is actively viewing the conversation.
- Only messages within the confirmed visible/read boundary are acknowledged.

Do not mark all messages as read merely because:
- A WebSocket message arrived.
- A conversation exists in the sidebar.
- The conversation summary was fetched.
- The browser tab is hidden.
- A different conversation is active.

If the user is reading older messages, do not automatically acknowledge newly arriving messages outside the viewed region.

Reuse the smart scrolling behavior from PROMPT_029.

Use a conservative and understandable read-boundary strategy.

A read cursor must not advance beyond the last message actually considered viewed.

Do not create excessive mark-read requests during scrolling.

Batch or debounce read acknowledgements when appropriate.

## 10. Realtime Unread Updates

Reuse the existing WebSocket/STOMP infrastructure.

When an incoming message arrives:

1. Identify the corresponding conversation.
2. Deduplicate by stable backend message ID.
3. Update the latest-message preview.
4. Update the latest-message timestamp.
5. Preserve conversation sorting.
6. Update unread state when appropriate.
7. Preserve search and filter state.

Avoid incrementing unreadCount multiple times when the same message arrives through REST and WebSocket.

Prefer authoritative server state or deterministic reconciliation when events are duplicated, delayed, or reordered.

After reconnect:
- Reconcile unread counts with the backend.
- Avoid permanently stale counts.
- Do not recreate subscriptions unnecessarily.

Do not introduce a new WebSocket architecture.

If the existing event system cannot safely support realtime read-state synchronization, use a minimal compatible extension.

## 11. Multiple Browser Tabs

Handle common multi-tab scenarios reasonably.

Example:

- Tab A opens conversation X.
- Tab B also displays the conversation list.
- Tab A reads the latest messages.
- Tab B should eventually reflect the updated unread count.

Prefer existing realtime mechanisms.

If immediate cross-tab synchronization is unavailable, reconcile with the backend on suitable lifecycle events such as window focus or reconnect.

Do not implement complex cross-device synchronization infrastructure solely for this prompt.

## 12. Read-State UI Feedback

When unread messages become read:
- Update the badge.
- Update conversation emphasis.
- Preserve the active chat panel.
- Do not reload the whole Messages page.
- Do not reset scroll position.
- Do not flash loading indicators.

Avoid optimistic state changes that permanently disagree with backend state.

If a mark-read request fails:
- Keep or restore a consistent unread state.
- Retry only when safe.
- Reconcile with backend data when appropriate.

Do not show intrusive toast notifications for every successful read acknowledgement.

## 13. Accessibility & Responsive Design

Desktop:
- Preserve the existing conversation sidebar and chat panel.
- Keep unread badges aligned.
- Prevent text and badges from overlapping.
- Maintain stable widths.

Mobile browser:
- Preserve responsive conversation navigation.
- Keep unread indicators readable.
- Ensure All / Unread controls remain usable.
- Avoid horizontal scrolling.
- Do not interfere with the message composer.

Accessibility:
- Provide meaningful labels for unread counts.
- Do not rely on color alone to indicate unread state.
- Support keyboard navigation.
- Preserve visible focus indicators.

Do not modify the Mobile application.

## 14. Performance Requirements

Avoid:
- N+1 unread count queries.
- Fetching all messages to calculate unread counts.
- Full conversation-list reloads after every message.
- Repeated mark-read calls for the same cursor.
- Duplicate WebSocket subscriptions.
- Unnecessary React rerenders.
- Global loading spinners when read state changes.

Use efficient backend queries and existing frontend state patterns.

Keep the implementation simple.

Do not introduce Redis, Kafka, or additional infrastructure for this feature.

## 15. Backend Tests

If backend changes are made, add relevant tests for:

1. DIRECT unread count.
2. GROUP unread count.
3. Own messages excluded from unread counts.
4. Independent read state for different users.
5. Mark-read operation.
6. Idempotent repeated mark-read.
7. Cursor monotonicity.
8. Unauthorized conversation access.
9. Invalid or unrelated message cursor.
10. Empty conversations.
11. New incoming messages after marking read.
12. Deleted groups and removed members.
13. Backward-compatible response fields.
14. Correct behavior after pagination.
15. Efficient unread count retrieval where practical.

Use the existing test framework.

Do not rewrite unrelated Backend modules.

## 16. Web Tests

Use the existing Web test framework.

Cover:

1. Unread badge rendering.
2. Zero unread count.
3. 99+ badge formatting.
4. DIRECT unread conversations.
5. GROUP unread conversations.
6. All filter.
7. Unread filter.
8. Search combined with Unread filter.
9. Conversation sorting preserved.
10. Mark-read success.
11. Mark-read failure.
12. Realtime unread updates.
13. Duplicate message event handling.
14. Hidden-tab behavior.
15. Conversation switching.
16. Active conversation stability.
17. Empty unread list.
18. Responsive controls where testable.

Prefer behavior-oriented tests over fragile implementation-detail assertions.

## 17. Manual Verification

Use at least two accounts where possible.

### Scenario A — DIRECT Chat

1. Account A opens GeoChat.
2. Account B sends three messages to A.
3. Account A views the conversation list.

Expected:
- The DIRECT conversation shows three unread messages.
- The latest-message preview is correct.
- The conversation is ordered correctly.

Then A opens and reads the messages.

Expected:
- The unread count becomes zero after the appropriate read acknowledgement.

### Scenario B — GROUP Chat

1. Create a group with A and B.
2. B sends messages.
3. A views the conversation list.

Expected:
- Group unread count increases.
- Other members' read state remains independent.

### Scenario C — Hidden Tab

1. A opens conversation X.
2. A switches to another browser tab.
3. B sends a message to X.

Expected:
- The hidden tab does not automatically mark the new message as read.
- Unread state is reconciled when A returns.

### Scenario D — Older Messages

1. A opens a conversation with many messages.
2. A scrolls upward to read older messages.
3. B sends a new message.

Expected:
- The scroll position is preserved.
- The new message is not incorrectly acknowledged as read.

### Scenario E — Unread Filter

1. Select Unread.
2. Search for a conversation.
3. Open and read it.

Expected:
- Filtering updates correctly.
- Active chat remains usable.
- No unexpected navigation or global reload occurs.

### Scenario F — Multiple Tabs

1. Open the same account in two browser tabs.
2. Read a conversation in Tab A.
3. Return to Tab B.

Expected:
- Tab B eventually displays the authoritative unread state.

## 18. Regression Testing

Verify existing functionality:

- Authentication.
- Friend management.
- User search.
- Nearby.
- DIRECT messaging.
- GROUP messaging.
- Group creation.
- Group renaming.
- Add/remove members.
- Leave group.
- Delete group.
- GROUP_DELETED synchronization.
- Notifications.
- Conversation search.
- Conversation sorting.
- Latest-message previews.
- Message timestamps.
- Sending feedback.
- Smart scrolling.
- Realtime updates.
- Responsive Messages layout.
- Smooth conversation switching.
- Logout and WebSocket cleanup.

Preserve all important PROMPT_028 and PROMPT_029 improvements.

## 19. Validation

Run supported Web checks from package.json.

At minimum, run the Web production build:

npm run build

Run available Web tests, lint, and typecheck commands where applicable.

If Backend code changes, run relevant tests through the Maven Wrapper.

Use the appropriate commands for the actual repository structure.

Do not run Mobile build, typecheck, or tests.

Report actual results.

## 20. Scope Protection

Do NOT implement:

- Mobile UI or Mobile features.
- Message read receipts visible to other participants.
- Delivery receipts.
- Typing indicators.
- Message reactions.
- Message editing/deletion.
- Message forwarding.
- File uploads.
- Voice/video messages.
- Voice/video calls.
- Full-text message search.
- Pinned conversations.
- Archived conversations.
- Push notification infrastructure.
- New authentication architecture.
- New WebSocket architecture.
- Unnecessary new dependencies.

Unread tracking is internal per-user conversation state.

Do not confuse unread counts with participant-visible read receipts.

## 21. Acceptance Criteria

PROMPT_030 is complete when:

- [ ] DIRECT conversations support unread counts.
- [ ] GROUP conversations support unread counts.
- [ ] Own messages are excluded from unread counts.
- [ ] Unread state persists after refresh.
- [ ] Unread badges display correctly.
- [ ] All / Unread filtering works.
- [ ] Search and sorting continue working.
- [ ] Read acknowledgements are authorized and idempotent.
- [ ] Read cursors do not move backward.
- [ ] Hidden tabs do not incorrectly mark messages as read.
- [ ] Reading older messages does not incorrectly acknowledge new messages.
- [ ] Realtime updates do not create duplicate unread increments.
- [ ] Reconnect reconciles unread state.
- [ ] Conversation switching remains smooth.
- [ ] Existing DIRECT and GROUP functionality works.
- [ ] Relevant Backend tests pass.
- [ ] Web build passes.
- [ ] Mobile code remains unchanged.

## 22. Final Report

Provide a report in Vietnamese containing:

1. Existing unread infrastructure discovered.
2. Files changed.
3. Database migrations, if any.
4. Backend read-state design.
5. API changes.
6. Web unread UI.
7. All / Unread filter behavior.
8. Realtime synchronization behavior.
9. Performance considerations.
10. Backend test results.
11. Web test and build results.
12. Manual verification actually performed.
13. Regression testing results.
14. Known limitations.
15. Confirmation that Mobile code was not modified.
16. Suggested scope for PROMPT_031.

Clearly distinguish:
- Implemented and tested.
- Implemented but not manually verified.
- Not implemented.

Do not claim tests passed unless they were actually executed.

End with exactly one of:

PROMPT_030 COMPLETE

or

PROMPT_030 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria pass.