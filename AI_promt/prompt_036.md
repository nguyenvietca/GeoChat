# PROMPT_036 — GeoChat Message Search & Conversation History Navigation

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
- PROMPT_029: Web Messaging UX Enhancements.
- PROMPT_030: Unread Messages and Read State.
- PROMPT_031: Web UI/UX Polish.
- PROMPT_032: Theme, Micro-interactions and UX Quality.
- PROMPT_033: Typing Indicator and Online Presence.
- PROMPT_034: Message Reply, Emoji Reactions and Message Actions.
- PROMPT_035: Secure Image Sharing and Attachment Preview.

IMPORTANT:
PROMPT_034 and PROMPT_035 were proposed in previous prompts, but their actual completion must be verified from the repository.

Do not assume a feature is implemented merely because it appeared in a previous prompt.

The current milestone is PROMPT_036.

Primary goals:
1. Search text messages within an existing conversation.
2. Display paginated search results.
3. Navigate to a selected message, including messages not currently loaded.
4. Highlight the selected message temporarily.
5. Preserve the existing chat experience and realtime behavior.
6. Maintain secure, efficient Backend queries.

This is not a global search feature.

---

# PART A — MANDATORY DEVELOPMENT RULES

## 2. Web-first Development

Prioritize:
- Search usability.
- Fast feedback.
- Clear search results.
- Reliable jump-to-message navigation.
- Responsive layout.
- Keyboard accessibility.
- Existing theme compatibility.
- Smooth interaction with chat history.

## 3. Backend Scope

Implement only the APIs and queries required for message search and history navigation.

Reuse:
- Existing ChatService authorization.
- Existing message entity and repository.
- Existing message DTOs.
- Existing pagination strategy.
- Existing JWT security.
- Existing database infrastructure.

Do not redesign message storage.

## 4. Mobile — Strictly Excluded

- Do not modify Mobile code.
- Do not implement Mobile UI.
- Do not add Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Preserve existing Mobile-facing APIs and JSON contracts.

## 5. Architecture Rules

- Preserve existing REST endpoints.
- Preserve existing WebSocket destinations.
- Preserve messageId and conversationId semantics.
- Preserve message ordering.
- Preserve unread/read-cursor behavior.
- Preserve smart scrolling.
- Preserve Reply and Reactions if implemented.
- Preserve image messages if implemented.
- Preserve Typing Indicator and Online Presence.
- Avoid unnecessary dependencies.
- Avoid unrelated refactoring.

Do not introduce Elasticsearch, OpenSearch, Redis, or a separate search microservice.

---

# PART B — REPOSITORY AUDIT

## 6. Inspect Before Coding

Inspect the actual repository.

Backend:
1. Message entity.
2. MessageRepository.
3. ChatService.
4. ChatController.
5. ChatDtos.
6. Conversation authorization.
7. Existing pagination queries.
8. Existing database indexes.
9. Existing Flyway migrations.
10. Group deletion behavior.
11. Reply and reaction models, if implemented.
12. Attachment models, if implemented.

Web:
1. MessagesPage.
2. ChatPanel.
3. Conversation sidebar.
4. Existing conversation search.
5. Message rendering.
6. messagePresentation.ts.
7. Smart scrolling.
8. History pagination.
9. Read-cursor tracking.
10. WebSocket message reconciliation.
11. Theme variables.
12. Existing tests.

Confirm:
- How message history is ordered.
- How older messages are loaded.
- Whether there is a cursor-based pagination strategy.
- How message rows are identified.
- How scroll position is preserved.
- How unread state is updated.
- Whether a reusable search input exists.

Known architecture from PROMPT_034 Preparation:
- Message IDs are generated Long values.
- Message rows use data-message-id.
- Web deduplicates messages by messageId.
- Web uses compareMessageOrder.
- Messages are ordered by createdAt and id.
- Existing REST history is paginated.
- Message responses preserve messageId, conversationId, senderId, content and createdAt.

Verify these facts against the current code.

Before coding, summarize:
- Current pagination behavior.
- Proposed search endpoint.
- Proposed history navigation strategy.
- Expected modified files.
- Compatibility considerations.

---

# PART C — MESSAGE SEARCH BACKEND

## 7. Search Scope

Implement text search within one conversation.

Support:
- DIRECT conversations.
- GROUP conversations.
- Existing text messages.
- Captions of image messages, if stored as message content.

Do not search:
- Other conversations.
- User profiles.
- Friend lists.
- Group names.
- Image binary.
- Image OCR content.
- Reaction emojis.
- Attachment filenames.
- Deleted conversations.

The existing conversation-name search must remain unchanged.

## 8. Search API

Add an authenticated REST endpoint following existing conventions.

Suggested:

GET /api/v1/chats/{conversationId}/messages/search

Query parameters:
- q: search keyword.
- limit: requested page size.
- cursor: optional pagination cursor.

These names are suggestions; adapt to existing conventions if necessary.

Requirements:
- JWT authentication.
- Conversation membership validation.
- Query validation.
- Stable result ordering.
- Bounded page size.
- Safe pagination.
- No cross-conversation data leakage.

Do not modify the existing message-list endpoint unnecessarily.

## 9. Search Query Validation

Validate:
- Query is not blank after trimming.
- Query length is bounded.
- Page size is bounded.
- Cursor is valid.
- Conversation exists.
- Current user is authorized.

Suggested limits:
- Minimum query length: 2 characters.
- Maximum query length: 100 characters.
- Default page size: 20.
- Maximum page size: 50.

These values may be adjusted to existing application conventions.

Treat search text as literal user input.

Do not expose raw SQL errors.

## 10. Search Semantics

For the initial version:

- Use case-insensitive substring matching.
- Search message content.
- Support Vietnamese Unicode text.
- Preserve meaningful punctuation.
- Return matching messages from the selected conversation only.

Example:

Query:
"meeting"

Matching content:
"Let's schedule a meeting tomorrow."

Do not require exact whole-word matching.

Do not introduce stemming, ranking, fuzzy matching, or semantic search.

Important:
When using SQL LIKE/ILIKE, escape wildcard characters in user input so '%' and '_' are treated as literal characters rather than uncontrolled wildcards.

Use parameterized queries.

Do not concatenate user input into SQL.

## 11. Search Result DTO

Return a compact paginated result.

Suggested fields:

MessageSearchResult:
- messageId
- conversationId
- senderId
- senderDisplayName
- contentSnippet
- createdAt

Optional:
- attachmentType, if needed for display.

Pagination metadata:
- nextCursor
- hasMore

Requirements:
- Stable message IDs.
- Consistent timestamps.
- No unnecessary attachment binary.
- No full conversation reload.
- No unrelated private data.

If existing DTOs can be reused safely, prefer reuse.

Avoid N+1 sender-name queries.

## 12. Search Ordering

Default ordering:
- Newest matching messages first.

Use a deterministic composite order:
- createdAt DESC
- id DESC

Do not rely on timestamp alone.

Pagination must not skip or duplicate results when multiple messages share the same timestamp.

Prefer keyset pagination when consistent with the existing repository.

If a cursor is introduced, validate its conversation/query scope or ensure it cannot expose unrelated data.

## 13. Search Performance

Start with the simplest reliable PostgreSQL query.

Evaluate existing indexes and expected data volume.

Possible optimization:
- PostgreSQL pg_trgm extension.
- GIN trigram index on message content.

However:
- Do not add pg_trgm automatically.
- Do not create a costly index without a clear need.
- Do not introduce Elasticsearch or OpenSearch.
- Do not rewrite the database schema for search.

If a new index is justified:
- Create a new Flyway migration.
- Document why it is needed.
- Consider PostgreSQL extension availability.
- Verify migration compatibility with the project's database setup.

For small local datasets, a bounded indexed-by-conversation query may be sufficient.

Document expected limitations.

---

# PART D — JUMP TO MESSAGE BACKEND

## 14. Problem Definition

The selected search result may refer to a message that is not currently loaded in the Web chat timeline.

The application must navigate to that message without loading the entire conversation history.

Example:
- Conversation contains 5,000 messages.
- Web currently displays the latest 30 messages.
- Search finds message #500.
- User selects the result.
- Web loads an appropriate history window around message #500.
- The target message becomes visible and highlighted.

Do not fetch all 5,000 messages.

## 15. Message Context API

Introduce a focused endpoint if the existing history API cannot efficiently load around a target message.

Suggested:

GET /api/v1/chats/{conversationId}/messages/{messageId}/context

Suggested parameters:
- before: number of messages before the target.
- after: number of messages after the target.

Suggested defaults:
- 15 before.
- 15 after.

Bound both parameters to prevent excessive queries.

Requirements:
- JWT authentication.
- Current conversation membership.
- Target message belongs to the requested conversation.
- Stable ordering.
- Efficient bounded queries.
- No cross-conversation access.
- Clear handling of missing messages.

Do not use offset pagination over the entire conversation just to locate the target.

## 16. Context Response

Suggested structure:

MessageContextResponse:
- targetMessageId
- messages
- hasOlder
- hasNewer
- olderCursor
- newerCursor

Reuse existing MessageResponse wherever possible.

If Reply, Reactions or Attachments are implemented, preserve their metadata in context responses.

Do not return a simplified message shape that breaks normal chat rendering.

## 17. Context Query Strategy

Use the existing composite ordering:
- createdAt
- id

Load:
- Target message.
- Bounded messages before the target.
- Bounded messages after the target.

Ensure correct ordering after combining results.

Handle identical timestamps.

Avoid N+1 queries for:
- Sender information.
- Reply previews.
- Reaction summaries.
- Attachment metadata.

Do not create an unbounded query.

## 18. Context Pagination

After jumping to a historical message:

- Loading older messages should still work.
- Loading newer messages should also be possible if the timeline is showing a historical window.
- The user should be able to return to the latest messages.

Important:
Inspect the current history-pagination architecture before implementing this.

If the current UI only supports loading older messages, extend it carefully to support a historical context window without corrupting the existing latest-message timeline.

Do not blindly append historical context messages to the latest timeline if it creates a large invisible gap.

Define explicit timeline-window behavior.

---

# PART E — WEB SEARCH EXPERIENCE

## 19. Search Entry Point

Add a search action to the existing chat header.

Requirements:
- Search the currently selected conversation.
- Do not replace conversation-name search.
- Use an accessible icon button.
- Show an appropriate tooltip or accessible label.
- Support Light/Dark themes.
- Support responsive layouts.

Do not add a global search feature.

## 20. Search Panel

Implement a compact search panel.

Desktop:
- Prefer a side panel or an existing compatible layout.

Mobile browser:
- Use an appropriate full-width or overlay presentation.

Requirements:
- Search input.
- Clear button.
- Close button.
- Search results.
- Loading state.
- Empty state.
- Error state.
- Pagination or Load More.

Avoid covering the message composer unnecessarily.

Preserve the selected conversation.

## 21. Search Input Behavior

Requirements:
- Debounce input.
- Cancel or ignore stale requests.
- Avoid searching on every keystroke.
- Trim query appropriately.
- Preserve meaningful Unicode characters.
- Show validation feedback for short queries.
- Clear previous results when switching conversations.

Suggested debounce:
Approximately 300ms.

Do not trigger duplicate API requests.

## 22. Search Results UI

Each result should show:
- Sender display name.
- Message text snippet.
- Timestamp.
- Highlighted matching text.
- Optional image indicator if applicable.

Requirements:
- Readable layout.
- Clear selected state.
- Accessible buttons.
- Keyboard navigation.
- Light/Dark compatibility.
- Responsive display.
- No horizontal overflow.

Use stable messageId keys.

Do not render full chat bubbles inside search results.

## 23. Highlight Search Matches

Highlight matching query text inside result snippets.

Requirements:
- Case-insensitive matching.
- Safe text rendering.
- No dangerouslySetInnerHTML for user messages.
- No HTML injection.
- Appropriate contrast.
- Preserve Unicode content.

Do not modify stored message content.

## 24. Search Result Pagination

Support loading more results.

Requirements:
- Preserve existing results.
- Avoid duplicate message IDs.
- Maintain stable ordering.
- Show loading feedback.
- Stop when hasMore is false.
- Avoid full search restart for each page.

Reset pagination when:
- Query changes.
- Conversation changes.
- Search panel closes, if appropriate.

## 25. Jump to Search Result

When a user selects a search result:

1. Capture target messageId.
2. Determine whether the message is already loaded.
3. If loaded, scroll to it.
4. If not loaded, request its context window.
5. Render the appropriate timeline window.
6. Scroll to the target after it is rendered.
7. Highlight the target temporarily.

Requirements:
- Do not fetch the entire history.
- Do not duplicate messages.
- Do not corrupt existing message order.
- Do not mark unrelated messages as read.
- Do not cause global layout flicker.
- Do not create an infinite scrolling loop.

## 26. Target Highlight

After navigating:

- Apply a subtle temporary highlight.
- Keep the target visible.
- Remove the highlight after a short interval.
- Respect reduced-motion preferences.
- Preserve normal bubble styling.

Suggested duration:
2–3 seconds.

Do not animate the entire conversation.

## 27. Return to Latest Messages

When viewing a historical context window, provide a clear way to return to the newest messages.

Suggested action:
"Jump to latest"

Requirements:
- Restore the latest timeline.
- Preserve realtime message handling.
- Preserve unread logic.
- Avoid duplicate messages.
- Avoid unnecessary full-page navigation.

Do not automatically jump to the newest message while the user is reviewing search results.

## 28. Search Panel Lifecycle

When closing search:
- Preserve the current conversation.
- Avoid unnecessary API calls.
- Restore focus appropriately.
- Do not reset the message composer.
- Do not reset an unsent draft.
- Do not disconnect WebSocket.
- Do not clear unread state incorrectly.

When switching conversations:
- Clear stale search results.
- Cancel or ignore previous requests.
- Prevent old search responses from appearing in the new conversation.

---

# PART F — REALTIME AND READ-STATE SAFETY

## 29. Realtime Message Handling

While the user is viewing historical messages:

- Continue receiving realtime messages.
- Do not force-scroll to the bottom.
- Do not lose new messages.
- Preserve latest-message previews.
- Preserve conversation sorting.
- Preserve unread counters.
- Provide a way to return to the latest messages.

Avoid merging a distant historical context window with the latest timeline as if all intermediate messages were loaded.

## 30. Read Cursor Safety

This is critical.

The existing application tracks read state using message boundaries and data-message-id.

Searching or jumping to an old message must not incorrectly mark newer unseen messages as read.

Requirements:
- Preserve monotonic read cursor semantics.
- Do not mark messages as read merely because search results were returned.
- Do not mark messages as read merely because a context API was called.
- Do not advance the read cursor past unseen gaps.
- Do not interpret a historical context window as a contiguous latest-message timeline.
- Preserve hidden-tab and inactive-conversation safety.

Review existing mark-as-read logic before modifying timeline rendering.

Add regression tests for this behavior.

## 31. Smart Scrolling

Preserve existing smart scrolling.

Requirements:
- No unexpected auto-scroll.
- No scroll jumps when older messages load.
- No scroll jumps when newer context messages load.
- No forced bottom scroll during historical navigation.
- Correct target positioning.
- Correct behavior when images load asynchronously.

If PROMPT_035 image messages exist, account for image dimensions and delayed image loading.

## 32. Reply Navigation Compatibility

If PROMPT_034 Reply functionality exists:

Consider reusing the new message-context navigation mechanism when a user clicks a reply preview whose original message is not loaded.

However:
- Do not rewrite Reply UI unnecessarily.
- Do not expand scope into new Reply features.
- Preserve existing behavior.
- Add tests if shared navigation code is introduced.

Prefer a small reusable navigation helper over duplicated history-loading logic.

---

# PART G — SECURITY AND QUALITY

## 33. Authorization

Every search and context request must enforce conversation access.

Test:
- Unauthorized DIRECT conversation.
- Unauthorized GROUP conversation.
- Removed group member.
- Deleted group.
- Message ID from another conversation.
- Nonexistent message.

Do not leak:
- Message content.
- Sender information.
- Attachment metadata.
- Reply previews.

Do not rely on Web-only authorization.

## 34. Error Handling

Handle:
- Empty query.
- Too-short query.
- Network failure.
- Unauthorized conversation.
- Deleted conversation.
- Deleted or missing target message.
- Invalid cursor.
- Stale search response.
- Failed context loading.

Provide concise user-friendly feedback.

Do not display raw stack traces.

## 35. Performance

Avoid:
- Full conversation history downloads.
- Offset scanning across thousands of messages for jump-to-message.
- N+1 queries.
- Repeated search requests.
- Repeated context requests.
- Duplicate message rendering.
- Excessive DOM nodes.
- Unnecessary WebSocket resubscriptions.
- Unnecessary React rerenders.

Use bounded queries and stable React keys.

Do not introduce a virtualization library solely for this milestone unless the current implementation clearly requires it.

## 36. Accessibility

Requirements:
- Search button has an accessible name.
- Search input has a label.
- Results are keyboard operable.
- Focus states are visible.
- Search status is announced appropriately.
- Target highlighting is not color-only.
- Reduced-motion preferences are respected.
- Escape closes the search panel when appropriate.
- Focus returns predictably.

Do not create intrusive screen-reader announcements for every result update.

---

# PART H — TESTING

## 37. Backend Tests

Test:

Search:
1. Valid DIRECT search.
2. Valid GROUP search.
3. Unauthorized search.
4. Removed group member search.
5. Case-insensitive matching.
6. Vietnamese Unicode text.
7. Literal '%' and '_' handling.
8. Empty query rejection.
9. Query length validation.
10. Stable ordering with identical timestamps.
11. Pagination without duplicates.
12. Invalid cursor handling.
13. Deleted conversation handling.

Context:
14. Existing target message.
15. Target not found.
16. Target belongs to another conversation.
17. Unauthorized context access.
18. Context ordering.
19. Before/after limits.
20. Boundary at oldest message.
21. Boundary at newest message.
22. Identical timestamp ordering.
23. Reply metadata preservation, if implemented.
24. Reaction metadata preservation, if implemented.
25. Attachment metadata preservation, if implemented.

## 38. Web Tests

Test:
1. Open search panel.
2. Close search panel.
3. Enter query.
4. Debounced search.
5. Clear query.
6. Search results.
7. No results.
8. Search failure.
9. Load more.
10. Duplicate result handling.
11. Stale request cancellation.
12. Conversation switching.
13. Jump to loaded message.
14. Jump to unloaded message.
15. Context loading.
16. Target highlighting.
17. Return to latest.
18. Realtime messages during historical viewing.
19. Read-cursor safety.
20. Smart scrolling.
21. Keyboard interaction.
22. Light/Dark themes.
23. Responsive behavior.
24. Reply navigation reuse, if implemented.

## 39. Manual Verification

Use two accounts and a conversation with enough history to require pagination.

Scenario A — Basic Search:
- A searches for a word in the current conversation.
- Results show matching messages.
- A selects a result.
- The correct message is highlighted.

Scenario B — Old Message:
- A searches for a message far back in history.
- A selects it.
- The application loads a bounded context window.
- The correct message becomes visible.

Scenario C — Realtime:
- A views an old message.
- B sends a new message.
- A is not forced to the bottom.
- The new message remains available.

Scenario D — Read Safety:
- A has unread messages.
- A searches and opens an older message.
- Newer unseen messages must not be incorrectly marked as read.

Scenario E — Group Security:
- Remove A from a group.
- A attempts to search or load message context.
- Access is denied.

Scenario F — Responsive:
- Test at 375px.
- Test at 768px.
- Test at 1440px.
- Verify search panel, results and jump navigation.

## 40. Regression Checklist

Verify:
- Authentication.
- Logout.
- Friends.
- Nearby.
- DIRECT chat.
- GROUP chat.
- Group management.
- Group deletion.
- Conversation-name search.
- Conversation sorting.
- Message pagination.
- Message sending.
- Smart scrolling.
- Unread counts.
- Mark-as-read.
- Typing Indicator.
- Online Presence.
- Reply.
- Emoji Reactions.
- Message Actions.
- Image sharing.
- Image viewer.
- Notifications.
- Theme switching.
- Responsive layout.
- WebSocket reconnect.

Only verify features actually present in the repository.

Do not run Mobile tests.

## 41. Validation Commands

Inspect actual package scripts.

Run:
- Web production build.
- Existing Web tests.
- Web typecheck/lint if available.
- Relevant Backend tests via Maven Wrapper.

If Flyway migration is added, validate it against the project's PostgreSQL configuration.

Report actual results.

Do not claim manual browser testing unless it was performed.

---

# PART I — IMPLEMENTATION PHASES

## 42. Phase 1 — Audit and Design

- Inspect current architecture.
- Confirm existing pagination.
- Confirm read-cursor behavior.
- Define search API.
- Define context API.
- Choose query strategy.
- Identify compatibility risks.

## 43. Phase 2 — Backend Search

- Implement search query.
- Implement authorization.
- Implement validation.
- Implement cursor pagination.
- Add Backend tests.
- Evaluate indexes.

## 44. Phase 3 — Backend Context Navigation

- Implement bounded context queries.
- Implement target authorization.
- Preserve existing MessageResponse metadata.
- Support older/newer cursors.
- Add Backend tests.

## 45. Phase 4 — Web Search UI

- Add search entry point.
- Add search panel.
- Add debounce.
- Add paginated results.
- Add safe highlighting.
- Add keyboard and responsive support.
- Add Web tests.

## 46. Phase 5 — Jump Navigation

- Implement loaded-message navigation.
- Implement unloaded-message context loading.
- Add temporary highlight.
- Add Jump to latest.
- Preserve realtime and read-cursor behavior.
- Add Web tests.

## 47. Phase 6 — Regression

- Run Backend tests.
- Run Web tests/build.
- Verify security.
- Verify pagination.
- Verify smart scrolling.
- Verify unread safety.
- Verify responsive layout.
- Document limitations.

Complete each phase before moving to the next.

---

# PART J — ACCEPTANCE CRITERIA

## 48. Completion Checklist

PROMPT_036 is complete when:

- [ ] Search works in DIRECT conversations.
- [ ] Search works in GROUP conversations.
- [ ] Search is case-insensitive.
- [ ] Vietnamese Unicode text is supported.
- [ ] Search results are paginated.
- [ ] Search ordering is deterministic.
- [ ] Unauthorized search is rejected.
- [ ] Search result snippets are safe to render.
- [ ] Jump to an already loaded message works.
- [ ] Jump to an unloaded message works.
- [ ] Context loading is bounded.
- [ ] Historical navigation supports older/newer messages.
- [ ] Target highlighting works.
- [ ] Jump to latest works.
- [ ] Realtime messages remain available.
- [ ] Read-cursor safety is preserved.
- [ ] Smart scrolling remains correct.
- [ ] Conversation-name search remains unchanged.
- [ ] Reply navigation remains functional if implemented.
- [ ] Image messages remain functional if implemented.
- [ ] Light/Dark themes remain supported.
- [ ] Responsive layouts work.
- [ ] Relevant Backend tests pass.
- [ ] Web build and tests pass.
- [ ] Mobile source remains unchanged.

## 49. Final Report

Provide a Vietnamese report containing:

1. Architecture audit.
2. Search API design.
3. Context API design.
4. Database query strategy.
5. Index or migration decisions.
6. Web search UI.
7. Jump-to-message implementation.
8. Realtime and unread safety.
9. Files modified.
10. Backend test results.
11. Web test/build results.
12. Manual verification actually performed.
13. Regression results.
14. Performance considerations.
15. Mobile compatibility assessment.
16. Known limitations.
17. Suggested scope for PROMPT_037.

Clearly distinguish:
- Implemented and tested.
- Implemented but not manually verified.
- Not implemented.

End with exactly one of:

PROMPT_036 COMPLETE

or

PROMPT_036 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.