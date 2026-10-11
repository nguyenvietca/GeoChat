# PROMPT_034 — GeoChat Message Reply, Emoji Reactions & Message Actions

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL/PostGIS, Flyway.
- Security: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Existing codebase, currently on hold.

Previous milestones:
- PROMPT_028: Group Management and Conversation Synchronization.
- PROMPT_029: Web Messaging UX.
- PROMPT_030: Unread Messages and Read State.
- PROMPT_031: Web UI/UX Polish.
- PROMPT_032: Theme, Micro-interactions and UX Quality.
- PROMPT_033: Typing Indicator, Online Presence and preparation for PROMPT_034.

Use the confirmed architecture documented in PROMPT_034 Preparation.

Do not assume every earlier milestone is complete without checking the actual repository.

## 2. Confirmed Existing Architecture

Backend:
- Message entity: backend/src/main/java/com/geochat/chat/entity/Message.java
- Message DTOs: backend/src/main/java/com/geochat/chat/dto/ChatDtos.java
- REST controller: backend/src/main/java/com/geochat/chat/controller/ChatController.java
- Chat authorization: ChatService
- WebSocket: ChatWebSocketController

Current message fields:
- Long id
- conversationId
- senderId
- content
- createdAt

Current MessageResponse:
- messageId
- conversationId
- senderId
- content
- createdAt

Existing REST:
- POST /api/v1/chats/{conversationId}/messages
- GET /api/v1/chats/{conversationId}/messages
- POST /api/v1/chats/{conversationId}/read

Existing persisted message destination:
- /topic/chat/{conversationId}

Web:
- apps/web/src/features/chat/ChatPanel.tsx
- apps/web/src/features/chat/messagePresentation.ts

Messages are deduplicated by messageId.

Message ordering uses compareMessageOrder.

Each rendered message row retains data-message-id, which is required for read-cursor tracking.

Typing events use separate destinations and must not be mixed with persisted message or reaction events.

## 3. Mandatory Rules

### Web
Primary focus:
- Reply UX.
- Emoji reactions.
- Message actions.
- Responsive design.
- Accessibility.
- Realtime feedback.

### Backend
Implement only the APIs and persistence required by these features.

Preserve existing contracts wherever possible.

### Mobile
- Do not modify Mobile code.
- Do not implement Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Read Mobile source only when necessary to verify compatibility.

### Architecture
- Preserve existing REST endpoints.
- Preserve existing WebSocket message destination.
- Preserve existing required message fields.
- Preserve message ordering.
- Preserve unread/read-cursor behavior.
- Preserve existing authorization.
- Avoid unrelated refactoring.

## 4. Inspect Before Coding

Inspect:
1. Message entity and repository.
2. ChatDtos.
3. ChatController.
4. ChatService.
5. ChatWebSocketController.
6. Conversation membership rules.
7. Existing Flyway migrations.
8. Group deletion behavior.
9. ChatPanel.
10. Message presentation utilities.
11. Existing WebSocket subscriptions.
12. Existing Web and Backend tests.
13. Mobile message JSON parsing, read-only.

Before coding, report:
- Current message schema.
- Existing API compatibility constraints.
- Proposed Flyway migration.
- Proposed Reply DTO shape.
- Proposed Reaction API and event shape.
- Group deletion cleanup strategy.
- Expected modified files.

Do not implement until the design is internally consistent.

---

# PART A — REPLY MESSAGE

## 5. Reply Data Model

Add optional reply support to the existing Message entity.

Suggested field:
- replyToMessageId: Long, nullable.

A message may reference another message in the same conversation.

Requirements:
- Normal messages remain valid without replyToMessageId.
- Reply references must point to an existing message.
- Referenced message must belong to the same conversation.
- A user cannot reply to a message in another conversation.
- Current conversation membership must be checked.
- Self-replies are allowed.
- Nested replies are allowed, but previews should show only the directly referenced message.
- Do not recursively load entire reply chains.

Do not implement message editing or individual message deletion.

## 6. Database Migration

Create a new Flyway migration.

Do not edit existing applied migrations.

Add a nullable reply reference to the existing message table.

Choose a suitable foreign-key strategy based on the actual schema.

Requirements:
- Existing rows remain valid.
- Existing message IDs remain unchanged.
- Existing ordering remains unchanged.
- Group deletion continues working.
- No orphaned reaction rows.
- No unexpected foreign-key constraint failures.

Because individual message deletion does not exist yet, do not introduce soft-delete behavior.

Document the selected deletion policy.

For group hard deletion, delete dependent reaction records before messages when required by the schema.

## 7. Reply Request Contract

Extend the existing send-message request with an optional field:

replyToMessageId

Requirements:
- Existing clients can omit the field.
- Existing required fields remain unchanged.
- Null means a normal message.
- Invalid references return a clear client error.
- Cross-conversation references are rejected.
- Unauthorized references are rejected.

Do not create a separate send-reply endpoint unless the existing architecture requires it.

## 8. Reply Response Contract

Extend MessageResponse with optional reply information.

Suggested:
- replyToMessageId
- replyPreview

Reply preview may contain:
- Original message ID.
- Sender display name.
- Short text excerpt.

Requirements:
- Preserve existing required fields.
- Preserve messageId type.
- Preserve createdAt semantics.
- Preserve existing message event destination.
- Avoid exposing unrelated private messages.
- Avoid N+1 queries.
- Avoid loading full message history for reply previews.

Important:
Inspect Mobile JSON decoding behavior before deciding whether optional fields can safely be included in the existing response.

If strict Mobile decoders cannot tolerate additive fields, choose a compatible representation rather than breaking existing clients.

## 9. Reply Composer UI

When a user selects Reply:

- Show a compact reply preview above the composer.
- Display the original sender.
- Display a short excerpt.
- Provide a cancel action.
- Preserve existing draft text.
- Preserve keyboard focus.
- Preserve Enter/Shift+Enter behavior.
- Preserve Vietnamese IME behavior.

The reply target must belong to the currently selected conversation.

Switching conversations must not accidentally send a reply to the previous conversation.

Choose a simple per-conversation reply-state strategy.

## 10. Reply Message Bubble

For messages containing replyToMessageId:

- Display a compact quoted preview.
- Show the original sender.
- Show a bounded text excerpt.
- Keep the actual reply content clearly separated.
- Support Light and Dark themes.
- Support narrow browser widths.

Clicking the preview:
- Scroll to the original message if it is currently loaded.
- If the original message is not loaded, do not break the UI.
- Provide graceful feedback.

Do not fetch the entire conversation history just to locate the original message.

Deep-linking or fetching older referenced messages can be deferred.

Preserve data-message-id on every message row.

---

# PART B — EMOJI REACTIONS

## 11. Reaction Data Model

Introduce a message reaction entity.

Suggested fields:
- id
- messageId
- userId
- emoji
- createdAt

Use existing entity conventions.

Enforce uniqueness:
(message_id, user_id, emoji)

This allows a user to react with different supported emojis while preventing duplicate identical reactions.

Use a limited initial emoji set:
- 👍
- ❤️
- 😂
- 😮
- 😢
- 😡

Normalize emoji values consistently.

Reject unsupported emoji values.

Do not implement arbitrary Unicode emoji selection yet.

## 12. Reaction Persistence

Create the required Flyway migration.

Requirements:
- Foreign key to the message.
- Foreign key or equivalent validated reference to the user.
- Unique constraint.
- Appropriate index for message reaction lookup.
- Correct cleanup when messages are hard-deleted.
- No orphaned reactions after group deletion.

Do not add Redis or external storage.

## 13. Reaction REST APIs

Follow existing REST naming conventions.

Suggested endpoints:

PUT /api/v1/chats/{conversationId}/messages/{messageId}/reactions/{emoji}

DELETE /api/v1/chats/{conversationId}/messages/{messageId}/reactions/{emoji}

These are suggested routes, not mandatory.

Use URL-safe handling of emoji values. If path-based emoji encoding is unreliable, use a small JSON request body and appropriate routes instead.

Requirements:
- JWT authentication.
- Conversation membership validation.
- Message belongs to conversation.
- Emoji validation.
- Idempotent add/remove behavior.
- Safe handling of concurrent requests.
- Clear errors for unauthorized access.
- No duplicate reactions.

Do not trust client-supplied user IDs.

## 14. Reaction Summary DTO

Expose aggregated reaction information.

Suggested structure:

ReactionSummary:
- emoji
- count
- reactedByMe

For each message, return only the supported aggregated reaction summaries.

Do not return all individual reaction users by default.

Requirements:
- Stable emoji ordering.
- Correct count.
- Correct reactedByMe.
- Efficient loading for paginated message history.
- No N+1 reaction queries.

Prefer batched queries for message IDs in the current page.

## 15. Reaction Realtime Events

Preserve the existing message destination:

/topic/chat/{conversationId}

Do not replace the current MessageResponse payload with a generic event envelope.

Publish reaction updates through a separate destination.

Suggested:

/topic/chat/{conversationId}/reactions

Define a dedicated event payload containing:
- Event ID or stable version.
- Conversation ID.
- Message ID.
- Updated reaction summary or equivalent reconciliation information.

Requirements:
- Authorization.
- No sensitive user information.
- Duplicate event tolerance.
- Out-of-order event handling.
- Reconnect reconciliation.
- No unnecessary full message-history reload.

Important:
Do not reuse typing activityId or typing eventId as a reaction version contract.

Define ordering and reconciliation appropriate for persisted reaction state.

## 16. Reaction Picker UI

Provide a compact reaction picker for each message.

Requirements:
- Show supported emojis.
- Allow selecting an emoji.
- Allow removing an existing reaction.
- Indicate which emojis the current user selected.
- Show aggregated reaction counts.
- Support keyboard navigation.
- Support screen readers.
- Support touch interaction.
- Support Light/Dark themes.

Do not introduce a large emoji picker dependency.

Use the limited supported emoji set.

## 17. Reaction Rendering

Display reactions beneath or adjacent to message bubbles.

Requirements:
- Compact layout.
- Stable alignment.
- Clear counts.
- Distinguish my reactions.
- Prevent overflow.
- Support group and direct messages.
- Do not interfere with message timestamps.
- Do not interfere with read-cursor tracking.

Do not cause excessive layout shifts when reactions change.

---

# PART C — MESSAGE ACTION MENU

## 18. Message Actions

Provide a contextual action menu for messages.

Initial actions:
- Reply.
- React.
- Copy text.

Requirements:
- Available for incoming and outgoing messages where appropriate.
- Do not show unsupported actions.
- Do not show Delete or Edit.
- Preserve message selection.
- Preserve conversation state.

Use existing dropdown/popover patterns.

Do not introduce a new UI library unless necessary.

## 19. Desktop Interaction

Support:
- Hover to reveal actions where appropriate.
- Click to open menu.
- Keyboard focus.
- Escape to close.
- Click outside to dismiss.

Do not make hover the only way to access actions.

## 20. Mobile Browser Interaction

Support:
- Visible accessible action trigger.
- Touch-friendly controls.
- No hover dependency.
- No horizontal overflow.
- No accidental message sending.

Long-press support is optional.

Do not implement Native Mobile UI.

## 21. Copy Message Text

Use the Clipboard API when available.

Requirements:
- Copy the message text only.
- Do not copy HTML markup.
- Provide subtle success feedback.
- Handle clipboard permission failure.
- Do not crash on unsupported browsers.

Use a safe fallback or explain that copying is unavailable.

---

# PART D — SECURITY & COMPATIBILITY

## 22. Authorization

Reuse ChatService membership checks.

Validate:
- Current user belongs to the conversation.
- Referenced reply message belongs to the conversation.
- Reaction target belongs to the conversation.
- Removed group members cannot modify reactions.
- Deleted conversations cannot accept actions.

Enforce checks on the Backend.

Do not rely only on hidden UI controls.

## 23. Mobile Compatibility

Inspect existing Mobile DTO parsing read-only.

Preserve:
- Existing REST endpoints.
- Existing required message fields.
- Existing message ID types.
- Existing message event destination.
- Existing authentication contracts.

Do not modify Mobile source.

Do not require Mobile testing.

Document any compatibility risk that cannot be verified without running Mobile.

## 24. Performance

Avoid:
- N+1 reply-preview queries.
- N+1 reaction-summary queries.
- Full history reloads after a reaction.
- Duplicate WebSocket subscriptions.
- Duplicate message rendering.
- Excessive React rerenders.
- Unnecessary group membership lookups.

Use batched queries and existing pagination.

## 25. Existing Feature Preservation

Preserve:
- DIRECT chat.
- GROUP chat.
- Message ordering.
- Message pagination.
- Message sending.
- Sending feedback.
- Smart scrolling.
- Conversation search and sorting.
- Latest-message previews.
- Unread counts.
- Mark-as-read.
- Typing Indicator.
- Online Presence.
- Theme system.
- Responsive layout.
- Group deletion.
- WebSocket cleanup.

Do not introduce layout flicker or message duplication.

---

# PART E — TESTING

## 26. Backend Tests

Test:

Reply:
1. Normal message without reply.
2. Valid same-conversation reply.
3. Invalid reply ID.
4. Cross-conversation reply rejection.
5. Unauthorized reply.
6. Reply preview correctness.
7. Existing response compatibility.

Reactions:
8. Add reaction.
9. Remove reaction.
10. Duplicate reaction.
11. Concurrent duplicate reaction.
12. Unsupported emoji.
13. Unauthorized reaction.
14. Cross-conversation reaction.
15. Aggregated counts.
16. reactedByMe.
17. Group deletion cleanup.
18. Reaction event publication.
19. Reconnect reconciliation strategy where testable.

## 27. Web Tests

Test:

1. Reply action.
2. Reply preview in composer.
3. Cancel reply.
4. Send reply.
5. Reply bubble rendering.
6. Switching conversations with active reply.
7. Reaction picker.
8. Add/remove reaction.
9. Reaction counts.
10. Duplicate reaction events.
11. Out-of-order reaction events.
12. Message action menu.
13. Copy text.
14. Keyboard interaction.
15. Responsive controls.
16. Light/Dark theme compatibility.
17. No message-order regression.
18. No unread regression.
19. No scroll regression.

## 28. Manual Verification

Use two accounts.

Scenario A — Reply:
- A sends a message.
- B replies to that message.
- A sees the reply preview.
- B can cancel reply before sending.

Scenario B — Reactions:
- A reacts with 👍.
- B sees the reaction.
- B reacts with ❤️.
- Both see updated counts.
- A removes 👍.
- Counts update correctly.

Scenario C — Group:
- Three users participate.
- Multiple reactions are added.
- Reply references remain within the group.
- Removed members cannot add reactions.

Scenario D — Pagination:
- Open a conversation with many messages.
- Reply to an older loaded message.
- Reload the conversation.
- Verify reply preview remains correct.

Scenario E — Responsive:
- Verify at 375px, 768px and 1440px.
- Check action menu and reaction picker.
- Verify no horizontal overflow.

## 29. Regression Testing

Verify:
- Authentication.
- Friend management.
- DIRECT/GROUP messaging.
- Group management.
- Group deletion.
- Message pagination.
- Smart scrolling.
- Unread state.
- Typing Indicator.
- Online Presence.
- Theme.
- Responsive layout.
- WebSocket reconnect.
- Logout cleanup.

Do not run Mobile tests.

## 30. Validation

Run supported Web checks:
- Build.
- Tests.
- Typecheck.
- Lint.

Run relevant Backend tests through Maven Wrapper.

Use actual repository scripts.

Do not run Mobile build, typecheck, or tests.

Report actual results.

---

# PART F — IMPLEMENTATION PLAN

## 31. Phase 1 — Architecture and Migration

- Inspect repository.
- Confirm API compatibility.
- Design reply schema.
- Design reaction schema.
- Create Flyway migrations.
- Add entities and repositories.
- Add Backend tests.

## 32. Phase 2 — Reply

- Extend send-message request.
- Extend response with optional reply fields.
- Implement validation.
- Implement reply preview.
- Implement Web composer UI.
- Implement reply bubble.
- Add tests.

## 33. Phase 3 — Reactions

- Implement reaction persistence.
- Implement reaction APIs.
- Implement reaction summaries.
- Implement realtime reaction events.
- Implement reaction picker and badges.
- Add tests.

## 34. Phase 4 — Message Actions

- Implement Reply/React/Copy menu.
- Add keyboard and touch support.
- Preserve message presentation boundaries.
- Add tests.

## 35. Phase 5 — Regression

- Run Backend tests.
- Run Web tests/build.
- Verify realtime behavior.
- Verify group deletion.
- Verify pagination and scrolling.
- Verify Mobile source remains unchanged.

---

# PART G — ACCEPTANCE CRITERIA

## 36. Completion Checklist

PROMPT_034 is complete when:

- [ ] Normal messages still work.
- [ ] Reply messages work in DIRECT and GROUP.
- [ ] Cross-conversation replies are rejected.
- [ ] Reply previews load efficiently.
- [ ] Reply UI supports cancel and conversation switching.
- [ ] Reactions can be added and removed.
- [ ] Duplicate reactions are prevented.
- [ ] Reaction summaries are correct.
- [ ] Reaction updates synchronize in realtime.
- [ ] Reconnect reconciles reaction state.
- [ ] Message action menu supports Reply, React and Copy.
- [ ] Keyboard and touch interaction work.
- [ ] Message pagination remains correct.
- [ ] Smart scrolling remains correct.
- [ ] Unread/read cursor behavior remains correct.
- [ ] Typing and presence remain correct.
- [ ] Group deletion cleans up dependent records.
- [ ] Existing APIs remain compatible where required.
- [ ] Relevant Backend tests pass.
- [ ] Web build and tests pass.
- [ ] Mobile code remains unchanged.

## 37. Final Report

Provide a Vietnamese report containing:

1. Architecture decisions.
2. Database migrations.
3. Backend changes.
4. API contracts.
5. WebSocket event contracts.
6. Web UI implementation.
7. Files changed.
8. Performance considerations.
9. Backend test results.
10. Web test/build results.
11. Manual verification actually performed.
12. Regression results.
13. Mobile compatibility assessment.
14. Known limitations.
15. Recommended next milestone.

Clearly distinguish:
- Implemented and tested.
- Implemented but not manually verified.
- Not implemented.

End with exactly one of:

PROMPT_034 COMPLETE

or

PROMPT_034 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.