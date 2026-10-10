# PROMPT_033 — GeoChat Typing Indicator, Online Presence & PROMPT_034 Preparation

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL, PostGIS, Flyway.
- Security: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Existing codebase, development postponed.

Previous milestones:
- PROMPT_027: Web Group Chat.
- PROMPT_028: Group Management and Conversation Synchronization.
- PROMPT_029: Web Messaging UX Enhancements.
- PROMPT_030: Unread Messages and Read State.
- PROMPT_031: Web UI/UX Polish.
- PROMPT_032: Dark Mode, Micro-interactions and UX Quality.

PROMPT_030 was confirmed complete.

PROMPT_031 and PROMPT_032 are preceding planned milestones. Inspect the repository to verify which improvements are actually implemented rather than assuming completion.

The current task is PROMPT_033.

Primary goals:
1. Implement realtime Typing Indicator.
2. Improve or reuse Online Presence.
3. Handle WebSocket lifecycle correctly.
4. Preserve all existing chat behavior.
5. Prepare the existing message architecture for PROMPT_034 without implementing its features.

## 2. Mandatory Development Rules

### Web — Primary Priority

Prioritize:
- User experience.
- Responsive layout.
- Realtime feedback.
- Accessibility.
- Performance.
- Maintainability.

### Backend — Only When Needed

Extend existing WebSocket functionality when required.

Reuse existing authentication and authorization.

Do not create a new realtime architecture.

### Mobile — Strictly Excluded

- Do not modify Mobile code.
- Do not implement Mobile UI.
- Do not add Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Preserve existing API contracts used by Mobile whenever reasonable.

### Architecture

- Preserve existing REST APIs.
- Preserve existing message DTO contracts.
- Preserve existing database schema unless strictly necessary.
- Avoid unnecessary dependencies.
- Avoid large refactoring.
- Preserve existing DIRECT and GROUP messaging.

## 3. Inspect Before Coding

Before implementation, inspect:

1. Existing WebSocket/STOMP configuration.
2. JWT authentication for WebSocket connections.
3. Current presence tracking, if any.
4. Existing user online/offline status.
5. Existing WebSocket subscription management.
6. DIRECT message routing.
7. GROUP message routing.
8. Existing message composer.
9. Conversation sidebar.
10. Chat header.
11. Existing group membership validation.
12. Existing WebSocket reconnect behavior.
13. Existing theme and responsive UI.
14. Existing Web and Backend tests.

Determine:
- Whether presence is already implemented.
- How WebSocket sessions are tracked.
- How users subscribe to conversations.
- Whether a user may have multiple active sessions.
- Whether the existing infrastructure supports targeted user events.
- Which features can be implemented without Backend changes.

Before coding, summarize the current architecture and proposed changes.

Do not duplicate existing functionality.

---

# PART A — TYPING INDICATOR

## 4. Feature Overview

Implement a realtime Typing Indicator for DIRECT and GROUP conversations.

Expected behavior:

DIRECT:
- User A types a message.
- User B sees "A is typing..." or equivalent localized text.

GROUP:
- User A types.
- Other group members see that A is typing.
- If multiple users type, display a compact summary.

Examples:
- Alice is typing...
- Alice and Bob are typing...
- Several people are typing...

Do not display the current user's own typing status.

Typing Indicator is ephemeral realtime state.

Do not persist typing events in the database.

## 5. Typing Event Protocol

Reuse the existing WebSocket/STOMP infrastructure.

Define or reuse a minimal typing event protocol.

Suggested event information:
- Conversation type: DIRECT or GROUP.
- Conversation identifier.
- Typing state: START or STOP.
- Sender identity derived from the authenticated WebSocket session.

These are conceptual fields.

Follow existing event naming conventions.

Do not blindly introduce new DTOs if suitable models already exist.

Important:
- Never trust a client-supplied sender ID.
- Authenticate WebSocket messages.
- Validate conversation membership.
- Do not broadcast typing information to unauthorized users.
- Do not expose typing activity to unrelated conversations.

## 6. Backend Authorization

For DIRECT conversations:
- Verify that the sender belongs to the conversation.
- Deliver typing events only to authorized participants.

For GROUP conversations:
- Verify current group membership.
- Deliver events only to current authorized members.
- Exclude removed members.
- Do not allow deleted groups to emit valid typing events.

Use the existing authorization model.

Do not introduce separate access rules for typing that contradict message access rules.

## 7. Typing START Behavior

When the user begins entering meaningful text:
- Send a typing START event.
- Do not send START on every keystroke.
- Throttle repeated START events.
- Keep typing state active while input continues.

Recommended:
- Send START immediately when meaningful typing begins.
- Refresh typing activity at a controlled interval only if needed by the timeout design.

Avoid excessive WebSocket traffic.

Do not send typing events for empty or whitespace-only drafts.

## 8. Typing STOP Behavior

Send STOP when:
- The user stops typing for a short period.
- The message is successfully sent.
- The composer becomes empty.
- The user switches conversations.
- The composer is unmounted or the page navigates away, when practical.

Recommended idle timeout:
Approximately 2–3 seconds.

The exact value may be adjusted to fit existing application behavior.

Do not rely only on STOP events.

The receiving client must automatically expire stale typing indicators.

Handle abrupt disconnects safely.

## 9. Typing State Expiration

Typing state must not remain visible indefinitely.

Requirements:
- Use a short expiry window.
- Expire stale indicators automatically.
- Handle missing STOP events.
- Handle WebSocket disconnects.
- Handle conversation switching.
- Avoid memory leaks from timers.
- Avoid unnecessary rerenders.

For a single-server deployment, use a simple in-memory strategy where appropriate.

If the application supports multiple Backend instances, document the limitations of in-memory presence/typing state.

Do not introduce Redis solely for this prompt.

## 10. Typing UI

Display Typing Indicator near the bottom of the active conversation.

Design requirements:
- Subtle appearance.
- Compact layout.
- Consistent typography.
- Light/Dark theme support.
- Responsive behavior.
- No overlapping composer.
- No disruptive layout jumps.
- No forced scroll when reading older messages.

A small animated three-dot indicator is optional.

If animation is used:
- Keep it subtle.
- Respect prefers-reduced-motion.
- Avoid continuous expensive animations.

Use existing design tokens.

## 11. Typing State and Conversation Switching

When switching conversations:
- Clear or isolate typing state for the previous conversation.
- Display only typing activity relevant to the selected conversation.
- Do not show stale typing from another chat.
- Do not reload the full conversation list.
- Do not recreate unrelated subscriptions.
- Do not reset message history unnecessarily.

Ensure delayed events from a previous conversation cannot incorrectly affect the new conversation.

Preserve PROMPT_028 conversation-switching stability fixes.

---

# PART B — ONLINE PRESENCE

## 12. Presence Feature Overview

Improve or reuse existing Online Presence.

Expected states:
- Online.
- Offline.
- Unknown, when status cannot be determined reliably.

Do not introduce misleading precision.

Presence should reflect the application's authenticated realtime connectivity according to the chosen presence model.

Do not claim that a user is actively viewing a particular conversation merely because they are online.

## 13. Presence Tracking

Inspect existing presence infrastructure first.

If presence already exists:
- Reuse it.
- Fix only verified issues.
- Avoid duplicate tracking systems.

If missing:
- Implement a minimal presence tracking mechanism using existing authenticated WebSocket sessions.

Requirements:
- Track users rather than treating each tab as a separate user.
- Support multiple active sessions for one user.
- Mark a user offline only when all relevant sessions have disconnected or expired.
- Handle reconnects.
- Handle abrupt connection loss.
- Avoid stale online state.

Do not use a single Boolean per user that is blindly cleared whenever any one tab disconnects.

## 14. Presence Privacy and Authorization

Presence must not be exposed to arbitrary users.

Follow existing privacy and relationship rules.

For example:
- Friends may view presence when existing product rules permit.
- Group members may view presence when authorized.
- Unrelated users must not receive unauthorized presence data.

Do not introduce new public presence endpoints without reviewing access control.

Do not expose:
- IP addresses.
- WebSocket session IDs.
- Connection tokens.
- Internal server metadata.

## 15. Presence UI

Review existing presence indicators.

Improve only where needed.

Possible locations:
- Friend list.
- DIRECT conversation header.
- Conversation sidebar.
- Group member list, if already present.

Visual behavior:
- Online: subtle status dot and accessible label.
- Offline: neutral status.
- Unknown: avoid showing a false online/offline claim.

Do not rely only on color.

Do not introduce last-seen timestamps in this prompt unless an existing reliable field already supports them.

## 16. Multi-tab Presence

Support scenarios where the same account opens multiple browser tabs.

Example:
- Tab A connects.
- Tab B connects.
- Tab A closes.
- Tab B remains connected.

Expected:
The user remains online.

Only after the final active session disconnects or expires should the user become offline.

Avoid rapid online/offline flicker during short reconnects.

Use a small disconnect grace period if appropriate.

## 17. WebSocket Reconnect and Cleanup

Preserve existing reconnect logic.

Requirements:
- No duplicate subscriptions.
- No leaked timers.
- No stale typing indicators.
- No repeated presence notifications without meaningful state changes.
- No unnecessary reconnect when switching theme.
- No unnecessary reconnect when selecting a conversation.
- Correct cleanup on logout.

When reconnecting:
- Restore required subscriptions.
- Refresh relevant presence state.
- Clear or reconcile stale typing state.
- Preserve message and unread functionality.

Do not rewrite the WebSocket architecture.

---

# PART C — PREPARATION FOR PROMPT_034

## 18. PROMPT_034 Planned Features

The next milestone is expected to include:

1. Reply to a specific message.
2. Emoji reactions.
3. Message action menu.

PROMPT_033 must prepare for these features without implementing them.

Do NOT:
- Add reply APIs.
- Add reaction APIs.
- Add reaction database tables.
- Add reply columns.
- Add message action buttons that do nothing.
- Add unfinished UI.
- Modify Mobile contracts unnecessarily.

Preparation should be limited to architecture review, small reusable improvements when justified, and documentation.

## 19. Message Model Review

Inspect current message models and DTOs.

Identify:
- Stable message identifier.
- Sender identifier.
- Conversation identifier.
- Conversation type.
- Message content.
- Creation timestamp.
- Message ordering.
- Existing deletion behavior, if any.

Determine whether the current structure can support future:
- replyToMessageId.
- Reaction aggregation.
- Message-level action permissions.

Do not add these fields yet.

Do not change the database schema for hypothetical future requirements.

## 20. Message UI Extensibility

Review existing message bubble components.

If the code already has clear component boundaries:
- Keep them.

If message rendering is tightly coupled and a small extraction is clearly beneficial:
- Consider a reusable MessageBubble component.
- Preserve existing props and behavior.
- Preserve message keys.
- Preserve scrolling behavior.
- Preserve message timestamps.
- Preserve DIRECT/GROUP differences.

Do not refactor the entire chat UI.

Do not create a generic plugin system for message actions.

## 21. Message Action Architecture Notes

Prepare a short design document:

docs/PROMPT_034_PREPARATION.md

If the repository uses another documentation location, follow its convention.

Include:

### Current Architecture
- Message entity/model locations.
- Message DTOs.
- REST message APIs.
- WebSocket message events.
- Web message rendering components.

### Proposed Reply Design
- How a message references another message.
- How reply previews could be represented.
- How cross-conversation references should be rejected.
- How missing or deleted original messages should be handled.
- How old clients remain compatible.

### Proposed Reaction Design
- How reactions associate with messages and users.
- How duplicate reactions should be prevented.
- How reaction summaries could be returned.
- How realtime updates could work.
- How authorization should be enforced.

### Proposed Message Actions
- Reply.
- React.
- Copy text, where appropriate.
- Permission-aware action visibility.

### Risks
- API compatibility.
- Database migrations.
- Authorization.
- WebSocket event ordering.
- Message pagination.
- Duplicate events.
- Performance.
- Mobile compatibility.

Clearly distinguish confirmed existing architecture from proposed future design.

Do not implement PROMPT_034 functionality in this milestone.

---

# PART D — PERFORMANCE & UX

## 22. Performance Requirements

Typing and presence must remain lightweight.

Avoid:
- WebSocket event per keystroke.
- Database writes for typing state.
- Full conversation reloads.
- Full friend-list reloads.
- Duplicate subscriptions.
- Excessive timers.
- Unnecessary React state updates.
- N+1 presence queries.
- Expensive presence polling.

Use existing application infrastructure.

Prefer small, understandable solutions.

## 23. Theme and Responsive Compatibility

Ensure new UI supports:
- Light Mode.
- Dark Mode.
- System theme.
- Reduced motion.
- Desktop.
- Tablet.
- Mobile browser.

Suggested viewport checks:
- 375px.
- 768px.
- 1440px.

No horizontal overflow.

No composer overlap.

No layout flicker.

Do not implement Native Mobile UI.

## 24. Accessibility

Typing indicators and presence should be accessible.

Requirements:
- Meaningful labels.
- Readable text.
- Appropriate contrast.
- Do not rely on color alone.
- Avoid excessive screen-reader announcements.
- Respect reduced-motion preferences.

Do not announce every typing START refresh.

Do not create intrusive toast messages for presence changes.

---

# PART E — TESTING

## 25. Backend Tests

If Backend code changes, test:

1. Authorized DIRECT typing event.
2. Unauthorized DIRECT typing event.
3. Authorized GROUP typing event.
4. Removed group member cannot emit typing events.
5. Deleted group cannot emit typing events.
6. Sender identity cannot be spoofed.
7. Typing events do not persist in database.
8. Multi-session presence.
9. Disconnect of one of multiple sessions.
10. Disconnect of final session.
11. Reconnect behavior.
12. Presence visibility authorization.
13. No duplicate presence transition notifications.

Use existing test patterns.

## 26. Web Tests

Test:

1. DIRECT typing indicator.
2. GROUP typing indicator.
3. Multiple users typing.
4. Own typing not displayed.
5. Typing idle timeout.
6. STOP event.
7. Missing STOP expiry.
8. Conversation switching.
9. Component cleanup.
10. Reconnect.
11. Online indicator.
12. Offline indicator.
13. Unknown presence.
14. Theme compatibility where testable.
15. Reduced-motion behavior where testable.
16. No regression in message sending.
17. No regression in unread behavior.

Use existing testing tools.

## 27. Manual Verification

Use at least two accounts.

### Scenario A — DIRECT Typing

1. Account A opens a conversation with B.
2. A begins typing.
3. B observes the conversation.

Expected:
B sees A typing.

4. A stops typing.

Expected:
The indicator disappears after the configured timeout.

### Scenario B — GROUP Typing

1. A, B and C join the same group.
2. A and B type.
3. C observes the group.

Expected:
C sees an appropriate multi-user typing summary.

### Scenario C — Conversation Switching

1. B sees A typing in conversation X.
2. B switches to conversation Y.

Expected:
Typing activity from X is not displayed in Y.

### Scenario D — Multi-tab Presence

1. A opens two tabs.
2. B observes A online.
3. A closes one tab.

Expected:
A remains online.

4. A closes the second tab.

Expected:
A eventually becomes offline.

### Scenario E — Reconnect

1. A and B are connected.
2. A temporarily loses network connectivity.
3. A reconnects.

Expected:
Presence eventually recovers.
Typing indicators do not remain stuck.
Subscriptions are not duplicated.

## 28. Regression Checklist

Verify:
- Authentication.
- Logout.
- Friends.
- Nearby.
- DIRECT chat.
- GROUP chat.
- Group creation.
- Group management.
- Group deletion.
- Conversation search.
- Conversation sorting.
- Latest-message previews.
- Message timestamps.
- Sending state.
- Smart scrolling.
- WebSocket message delivery.
- Unread counts.
- All/Unread filter.
- Mark-as-read behavior.
- Hidden-tab behavior.
- Notifications.
- Light/Dark/System theme.
- Responsive layout.

Do not run Mobile tests.

## 29. Validation

Inspect actual repository scripts.

Run:
- Web build.
- Existing Web tests.
- Lint/typecheck when available.
- Relevant Backend tests if Backend changed.

Use Maven Wrapper for Backend tests.

Do not run Mobile build, typecheck or tests.

Report actual command results.

---

# PART F — IMPLEMENTATION ORDER

## 30. Phase 1 — Architecture Audit

- Inspect WebSocket infrastructure.
- Inspect presence tracking.
- Inspect message components.
- Identify required changes.
- Confirm API compatibility strategy.

## 31. Phase 2 — Typing Indicator

- Define or reuse typing protocol.
- Implement authorization.
- Implement START/STOP behavior.
- Implement timeout and cleanup.
- Implement DIRECT/GROUP typing UI.
- Add tests.

## 32. Phase 3 — Online Presence

- Reuse or improve presence infrastructure.
- Handle multi-tab sessions.
- Handle reconnect/disconnect.
- Improve Web presence UI.
- Add tests.

## 33. Phase 4 — PROMPT_034 Preparation

- Review message models.
- Review message UI boundaries.
- Make only small justified structural improvements.
- Write docs/PROMPT_034_PREPARATION.md.
- Do not implement Reply/Reactions.

## 34. Phase 5 — Regression & Validation

- Run relevant Backend tests.
- Run Web build/tests.
- Verify realtime behavior.
- Verify UI responsiveness.
- Verify theme compatibility.
- Verify existing functionality.

---

# PART G — ACCEPTANCE CRITERIA

## 35. Completion Checklist

PROMPT_033 is complete when:

- [ ] DIRECT typing works.
- [ ] GROUP typing works.
- [ ] Multiple typing users are supported.
- [ ] Own typing is not displayed.
- [ ] Typing events are throttled.
- [ ] Typing state expires automatically.
- [ ] Conversation switching does not leak typing state.
- [ ] Typing events are authorized.
- [ ] Presence works or existing presence is correctly reused.
- [ ] Multi-tab presence is handled correctly.
- [ ] Reconnect and disconnect cleanup work.
- [ ] No duplicate WebSocket subscriptions.
- [ ] No unnecessary database changes.
- [ ] Light/Dark themes remain supported.
- [ ] Responsive chat layout remains stable.
- [ ] Existing chat/unread behavior remains operational.
- [ ] PROMPT_034 preparation document is created.
- [ ] No Reply/Reactions functionality is implemented yet.
- [ ] Relevant Backend tests pass.
- [ ] Web build passes.
- [ ] Mobile code remains unchanged.

## 36. Final Report

Provide a Vietnamese report containing:

1. Existing WebSocket and presence architecture.
2. Typing Indicator implementation.
3. Presence implementation or improvements.
4. Backend changes.
5. Web changes.
6. Files modified.
7. Realtime event protocol.
8. Authorization handling.
9. Performance and cleanup strategy.
10. Backend test results.
11. Web test and build results.
12. Manual verification actually performed.
13. Regression results.
14. Known limitations.
15. PROMPT_034 preparation document location.
16. Recommended implementation scope for PROMPT_034.

Clearly distinguish:
- Implemented and tested.
- Implemented but not manually verified.
- Not implemented.

End with exactly one of:

PROMPT_033 COMPLETE

or

PROMPT_033 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.