# PROMPT_029 — Web Messaging UX Enhancements

## 1. Context

GeoChat is a social location-based chat application with Backend, Web, and Mobile.

Current technology stack:

- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper
- Database: PostgreSQL, PostGIS, Flyway
- Security: JWT
- Realtime: WebSocket/STOMP
- Web: React + TypeScript
- Architecture: Modular monolith

Completed milestones:

- PROMPT_025 — Group Chat Backend Foundation
- PROMPT_026 — Mobile Group Chat
- PROMPT_027 — Web Group Chat + Facebook-style Messages Layout
- PROMPT_028 — Web Group Management & Conversation Synchronization

PROMPT_028 also fixed several important issues:

1. MessagesPage no longer reloads all conversations when switching routes or selecting chats.
2. `useNavigate()` identity changes must not trigger the main `load()` function.
3. Conversation switching must not show unnecessary "Loading conversations..." spinners.
4. Group-event WebSocket subscriptions must not be recreated unnecessarily.
5. `titleHint` prevents conversation header flickering.
6. `scrollbar-gutter: stable` and appropriate minimum widths prevent layout shifts.
7. Owner-only groups remain visible in conversation lists.
8. Group owners can delete groups through `DELETE /api/v1/groups/{groupId}`.
9. `GROUP_DELETED` events synchronize group deletion.
10. Web group creation requires at least one selected friend, while the backend still supports owner-only groups for Mobile compatibility.

**Preserve all these behaviors.**

---

## 2. Scope — Web First

This prompt focuses on improving the Web messaging experience.

### Web

Primary implementation target:

- Conversation search.
- Conversation sorting.
- Latest-message previews.
- Message timestamps.
- Message sending feedback.
- Smart scrolling.
- Smooth conversation switching.
- Responsive layout.
- Performance improvements.

### Backend

Modify the backend only when necessary to support Web features efficiently and securely.

Prefer existing APIs and DTOs.

Preserve existing API contracts used by Mobile.

### Mobile

- Do not implement Mobile UI.
- Do not add Mobile features.
- Do not modify Mobile code.
- Do not require Mobile build or tests.
- Do not introduce unnecessary breaking API changes.

---

## 3. Goal

Improve the existing Web Messages page to provide a smooth, modern messaging experience similar to Facebook Messenger.

The application must remain lightweight and responsive.

Target layout:

```text
+---------------------------------------------------------------+
| Messages                                                      |
+---------------------------+-----------------------------------+
| Conversations             | Alice                             |
|                           |-----------------------------------|
| Search conversations...   |                                   |
|                           | Alice: Hello!                     |
| Alice                     |                         Hi!       |
| Hello!             10:32  |                                   |
|                           |                                   |
| Project Group             |                                   |
| Bob: Updated docs  09:15  |                                   |
|                           |                                   |
| Bob                       |                                   |
| See you later     Yesterday|                                  |
|                           |-----------------------------------|
|                           | Type a message...         [Send]  |
+---------------------------+-----------------------------------+
         ~40%                           ~60%
```

The design is illustrative. Follow existing GeoChat design conventions rather than copying Facebook exactly.

---

## 4. Inspect Before Coding

Before implementing anything:

1. Inspect `MessagesPage` and related components.
2. Inspect existing conversation-list state and loading logic.
3. Inspect Direct Chat and Group Chat components.
4. Inspect current REST APIs and conversation DTOs.
5. Inspect WebSocket/STOMP subscription lifecycle.
6. Inspect message history pagination.
7. Inspect existing CSS and responsive breakpoints.
8. Inspect the fixes implemented in PROMPT_028.
9. Inspect current Web tests and build scripts.
10. Identify which requested features already exist.

Do not duplicate working functionality.

Do not introduce unnecessary new dependencies or state-management frameworks.

Briefly summarize the current implementation and intended changes before coding.

---

## 5. Conversation Search

Add a search field to the left Messages panel.

Users should be able to search existing conversations by:

- Direct conversation participant name.
- Group name.

Requirements:

- Case-insensitive matching.
- Ignore leading and trailing whitespace.
- Search updates without full-page reload.
- Preserve the selected conversation when the search query changes.
- Display a useful empty state when there are no matches.
- Provide a clear-search action.
- Support keyboard input naturally.

Use local filtering when the already-loaded conversation data is sufficient.

Do not call the backend on every keystroke unnecessarily.

This is conversation search, not message-content search.

Do not introduce global user search or a new search backend.

---

## 6. Conversation Sorting

Sort conversations by the most recent message activity.

Expected order:

1. Conversation with the newest message.
2. Next newest conversation.
3. Older conversations.

Requirements:

- Use the actual latest-message timestamp when available.
- Use an existing conversation timestamp as a fallback for conversations without messages.
- Preserve a deterministic order for equal timestamps.
- Do not assume conversation ID order represents message recency.
- Update ordering when a new message is sent or received.
- Support both DIRECT and GROUP conversations.
- Keep owner-only groups visible.
- Avoid unnecessary full-list refetches.

When a message arrives through WebSocket, update only the relevant conversation data.

Do not reload every conversation or call `getGroup` for every group.

If the backend does not expose enough information for efficient sorting, add the minimum necessary backward-compatible fields or query support.

---

## 7. Latest Message Preview

Each conversation should display a short preview of its latest message.

Examples:

**Direct conversation**

```text
Alice
Hello! Are you available?
```

**Group conversation**

```text
Project Group
Bob: Updated the documentation.
```

Requirements:

- Display the latest text message when available.
- For GROUP conversations, show the sender's display name when available.
- Handle empty conversations.
- Truncate long previews visually.
- Do not display raw HTML.
- Do not render message text using unsafe HTML injection.
- Avoid displaying sensitive information from unrelated conversations.
- Update the preview after sending or receiving messages.

For conversations without messages, use a neutral placeholder such as:

`No messages yet`

Do not fetch the complete message history for every conversation just to calculate previews.

Prefer efficient conversation summary data from the backend.

---

## 8. Conversation Timestamps

Display the time of the latest message or relevant conversation activity.

Recommended formats:

- Today: `10:32`
- Yesterday: `Yesterday`
- Older dates: short localized date

Requirements:

- Use timestamps returned by the backend.
- Handle missing or invalid timestamps safely.
- Avoid unnecessary continuous rerenders.
- Use consistent formatting across DIRECT and GROUP conversations.
- Display readable timestamps in the conversation list.
- Preserve correct chronological ordering independently of formatted display text.

Use the existing date utility if available.

Do not introduce a large date library solely for this feature.

---

## 9. Message Bubble Timestamps

Improve timestamps inside the active chat panel.

Requirements:

- Display message time clearly without clutter.
- Differentiate current-user messages from other users' messages.
- Preserve group sender names.
- Use consistent time formatting.
- Keep message text readable on desktop and narrow screens.

Do not redesign the entire message bubble system if it already works.

---

## 10. Message Sending State

Improve the message composer and sending feedback.

Expected states:

- Ready.
- Sending.
- Failed.

Requirements:

1. Prevent accidental duplicate submissions.
2. Show sending feedback.
3. Preserve the draft when a send request fails.
4. Display a useful failure message.
5. Allow retrying safely.
6. Avoid displaying the same message twice when REST and WebSocket both deliver it.
7. Disable or appropriately guard the Send action while an identical request is pending.
8. Trim or validate empty messages using existing rules.
9. Preserve existing keyboard-send behavior.

If the existing backend does not support client-generated idempotency keys, do not assume a timed-out request was not persisted.

Avoid blind automatic retries that could create duplicate messages.

Do not implement a persistent offline message queue.

Do not implement read receipts or delivery receipts.

"Sending" and "Failed" are local request states, not proof of message delivery or reading.

---

## 11. Smart Chat Scrolling

Improve scrolling behavior in the active conversation.

Expected behavior:

### Opening a conversation

- Display the newest messages.
- Position the scroll near the latest message after initial history loads.

### Receiving a new message

If the user is already near the bottom:

- Scroll to the latest message smoothly.

If the user is reading older messages:

- Do not force-scroll to the bottom.
- Preserve their reading position.
- Optionally display a small "New messages" or "Jump to latest" action.

### Loading older messages

- Preserve the user's current visible position.
- Do not jump to the top or bottom unexpectedly.
- Avoid layout flickering.

### Switching conversations

- Avoid carrying the previous conversation's scroll position into the new conversation incorrectly.
- Do not render stale messages from the previous conversation.
- Do not trigger a full conversation-list reload.

Use existing pagination behavior.

Do not replace working pagination with an unbounded full-history fetch.

---

## 12. Smooth Conversation Switching

Preserve and strengthen the optimizations from PROMPT_028.

Critical requirements:

- Do not make `MessagesPage.load()` depend on unstable navigation function identities.
- Do not reload all conversations when the selected conversation changes.
- Do not refetch all friends on each conversation switch.
- Do not refetch all group details on each conversation switch.
- Do not recreate group-event subscriptions unnecessarily.
- Do not flash the global conversation-loading spinner.
- Do not flash incorrect conversation titles.
- Preserve `titleHint` or an equivalent working solution.
- Preserve layout stability and scrollbar behavior.

A conversation switch should update only the data needed for the selected conversation.

Ensure stale async responses cannot overwrite the currently selected conversation.

---

## 13. Realtime Conversation Updates

Reuse the existing WebSocket/STOMP architecture.

When a new message arrives:

1. Identify its conversation.
2. Deduplicate by stable backend message ID.
3. Update the active message list if the conversation is selected.
4. Update the conversation preview.
5. Update the latest-message timestamp.
6. Move the conversation to the correct position in the list.
7. Preserve current search and selection state.

Requirements:

- No duplicate messages.
- No duplicate conversation entries.
- No unnecessary global refetch.
- No stale WebSocket subscriptions.
- No unauthorized message display.
- Correct behavior after reconnect.

Preserve existing `GROUP_DELETED` and other group-management event handling.

If conversation-list updates require additional realtime subscriptions, extend the existing architecture carefully, with authorization and cleanup.

Do not subscribe to every conversation without evaluating scalability and existing backend behavior.

---

## 14. Empty Conversations

Handle conversations without messages correctly.

Examples:

- Newly created DIRECT conversation.
- Newly created GROUP conversation.
- Owner-only GROUP conversation.

Requirements:

- Conversation remains visible.
- Correct title is displayed.
- No misleading message preview.
- User can start chatting when authorized.
- Sorting fallback is deterministic.
- No runtime errors due to null latest-message fields.

Do not change backend behavior that permits owner-only groups.

---

## 15. Responsive Layout

Preserve the existing desktop Messages layout:

- Left panel approximately 40%.
- Right panel approximately 60%.

For narrow browser widths:

- Use the existing responsive conversation-list/chat navigation.
- Keep the composer accessible.
- Prevent horizontal overflow.
- Keep long names and previews truncated appropriately.
- Ensure message bubbles remain readable.

Preserve:

- `scrollbar-gutter: stable`.
- Stable conversation-header sizing.
- Appropriate minimum widths.
- Existing presence-label layout fixes.

Do not introduce layout shifts when selecting conversations or receiving messages.

---

## 16. Performance Requirements

Avoid:

- N+1 `getGroup` requests on every conversation switch.
- Repeated full conversation-list requests.
- Fetching complete message histories for previews.
- Duplicate WebSocket subscriptions.
- Unnecessary React effect reruns.
- Excessive rerendering.
- Expensive filtering on every render without need.
- Repeated state updates for identical message events.

Use `useMemo`, `useCallback`, refs, and component boundaries where appropriate, but do not over-engineer.

Prefer simple, maintainable solutions.

If a backend conversation-summary query is needed:

- Return only required data.
- Avoid N+1 database queries.
- Preserve authorization filtering.
- Add appropriate tests.
- Keep existing response fields and API compatibility.

---

## 17. Backend Changes — Only If Necessary

Inspect the current conversation-list API.

Determine whether it already provides:

- Conversation ID.
- Conversation type.
- Conversation name or participant information.
- Latest message.
- Latest message sender.
- Latest message timestamp.
- Conversation creation/update timestamp.

If required data is missing, add a minimal backward-compatible extension.

Requirements:

- Existing Mobile API consumers must remain compatible.
- Do not remove existing fields.
- Do not change existing field meanings.
- Do not introduce breaking response formats.
- Preserve Direct Chat and Group Chat authorization.
- Avoid N+1 queries.
- Add backend tests for new query behavior.

Do not add new database columns unless justified by the existing model and query requirements.

---

## 18. Web Tests

Use the existing Web testing framework.

Cover at least:

1. Conversation search by friend name.
2. Conversation search by group name.
3. Case-insensitive filtering.
4. Empty search results.
5. Sorting by latest message timestamp.
6. Conversations without messages.
7. Latest-message preview rendering.
8. Timestamp formatting.
9. Sending state.
10. Send failure and safe retry behavior.
11. REST/WebSocket message deduplication.
12. Realtime preview and ordering updates.
13. Scroll behavior when near the bottom.
14. Scroll preservation when reading older messages.
15. Conversation switching without global reload.
16. Group deletion event handling.
17. Responsive layout where testable.

Prefer meaningful behavioral tests over fragile implementation-detail assertions.

---

## 19. Backend Tests

Only add backend tests when backend code changes.

Cover relevant scenarios such as:

- Correct latest-message summary.
- Correct latest-message timestamp.
- Correct sender information.
- Empty conversations.
- DIRECT and GROUP ordering.
- Owner-only group visibility.
- Unauthorized conversation filtering.
- Backward-compatible API response behavior.
- Efficient query behavior where measurable.

Do not require unrelated backend rewrites.

---

## 20. Manual Verification

Use two or three accounts.

### Scenario A — Conversation Search

1. Open Messages.
2. Search for a friend.
3. Select the friend.
4. Clear the search.
5. Search for a group.

Expected: correct filtering without page reload.

### Scenario B — Sorting

1. Open several conversations.
2. Send a message in an older conversation.
3. Return to the conversation list.

Expected: the conversation moves to the top according to latest-message activity.

### Scenario C — Realtime

1. Account A opens Messages.
2. Account B sends A a message.
3. Account A receives the message.

Expected: preview and timestamp update without a full conversation-list reload.

### Scenario D — Scrolling

1. Open a conversation with enough messages to scroll.
2. Scroll upward.
3. Receive a new message.

Expected: the scroll position is preserved.

4. Return near the bottom.
5. Receive another message.

Expected: the latest message becomes visible.

### Scenario E — Layout Stability

1. Switch rapidly between friends and groups.
2. Open and close group information.
3. Send and receive messages.
4. Delete a group as owner.

Expected:

- No global spinner flash.
- No conversation-list reload on every selection.
- No header title flicker.
- No unexpected layout shifts.
- No duplicate subscriptions.
- Deleted group disappears correctly.

---

## 21. Regression Checklist

Verify existing Web functionality:

- Authentication.
- Friends.
- User search.
- Nearby.
- DIRECT conversations.
- GROUP conversations.
- Group creation.
- Group renaming.
- Add/remove group members.
- Leave group.
- Delete group.
- `GROUP_DELETED` events.
- Notifications.
- Profile and settings.
- Logout and WebSocket cleanup.

Do not regress PROMPT_028 behavior.

---

## 22. Validation

Run the existing Web validation commands supported by `package.json`.

At minimum:

```bash
npm run build
```

Run existing tests, lint, and typecheck scripts where available.

If backend changes are made, run relevant backend tests through the Maven Wrapper.

Do not run Mobile builds or Mobile tests.

Report actual command results, not assumed results.

---

## 23. Scope Protection

Do NOT implement:

- Mobile UI or Mobile-specific features.
- Read receipts.
- Typing indicators.
- Online presence redesign.
- Message reactions.
- Message editing/deletion.
- Message forwarding.
- File uploads.
- Image/video messages.
- Voice messages.
- Voice/video calls.
- Full-text message search.
- Advanced conversation filtering.
- Pinned conversations.
- Archived conversations.
- Persistent offline messaging.
- New authentication architecture.
- New WebSocket architecture.
- Unnecessary new dependencies.

Focus only on improving existing Web messaging UX and the minimum backend support it needs.

---

## 24. Final Report

Report:

1. Files changed.
2. Conversation search implementation.
3. Conversation sorting implementation.
4. Latest-message preview implementation.
5. Timestamp behavior.
6. Sending-state improvements.
7. Smart scrolling implementation.
8. Realtime conversation-list updates.
9. Performance optimizations.
10. Backend changes, if any.
11. Tests added and results.
12. Web build/typecheck/lint results.
13. Manual verification actually performed.
14. Known limitations.
15. Confirmation that Mobile code was not modified.

End with exactly one of:

`PROMPT_029 COMPLETE`

or

`PROMPT_029 NOT COMPLETE`

Only report COMPLETE when all required acceptance criteria pass. Do not claim manual verification for scenarios that were not actually executed.