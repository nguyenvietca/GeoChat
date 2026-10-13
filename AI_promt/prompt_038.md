# PROMPT_038 — GeoChat Chat Performance & Pagination Optimization

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS, Flyway.
- Security: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Development postponed.

Confirmed completed milestones:
- PROMPT_036 — Nearby Discovery & Map UX.
- PROMPT_037 — Friend Discovery & Connection UX.

Previous chat milestones include:
- Group Chat and Group Management.
- Messaging UX improvements.
- Unread Messages and Read State.
- Theme and Accessibility.
- Typing Indicator and Online Presence.
- Reply, Emoji Reactions and Message Actions.
- Image Sharing and Attachment Preview.

Verify actual repository implementation before assuming any feature exists.

## 2. Primary Objective

Improve the performance and reliability of GeoChat messaging, especially for conversations containing large message histories.

Focus on:

1. Efficient message rendering.
2. Reliable message pagination.
3. Smooth scrolling.
4. Efficient image loading.
5. Stable WebSocket event handling.
6. Reduced unnecessary React rerenders.
7. Efficient Backend database queries.
8. Correct unread/read-cursor behavior.

Do not implement unrelated new features.

Do not implement Message Search.

---

# PART A — MANDATORY DEVELOPMENT RULES

## 3. Web-first Development

Prioritize:
- Chat UI performance.
- Scroll stability.
- Message rendering.
- User experience.
- Realtime responsiveness.

Backend changes are allowed when necessary.

## 4. Mobile — Strictly Excluded

- Do not modify Mobile source.
- Do not implement Mobile UI.
- Do not implement Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Preserve existing Mobile-facing APIs whenever reasonable.

Mobile source may be inspected read-only for compatibility.

## 5. Architecture Constraints

- Preserve existing modular monolith.
- Preserve REST endpoint contracts.
- Preserve WebSocket destinations.
- Preserve message IDs.
- Preserve chronological ordering.
- Preserve DIRECT and GROUP chat.
- Preserve existing pagination behavior unless fixing verified defects.
- Preserve read-cursor semantics.
- Preserve Reply and Reactions.
- Preserve image messages.
- Preserve typing and presence.
- Preserve current UI design and theme system.

Avoid:
- Unnecessary dependencies.
- Large refactoring.
- Redis.
- Separate messaging microservices.
- Premature caching.
- Unjustified database migrations.

## 6. Performance-first Principles

Before optimizing:
1. Identify the actual bottleneck.
2. Establish a baseline where possible.
3. Implement the smallest effective change.
4. Measure or verify the result.
5. Add regression tests.

Do not claim improvements without evidence.

Do not optimize working code solely based on assumptions.

---

# PART B — REPOSITORY AUDIT

## 7. Inspect Current Architecture

Backend:
1. Message entity.
2. MessageRepository.
3. ChatService.
4. ChatController.
5. Chat DTOs.
6. WebSocket message delivery.
7. Conversation authorization.
8. Reaction persistence.
9. Reply preview loading.
10. Attachment metadata loading.
11. Database indexes.
12. Flyway migrations.

Web:
1. MessagesPage.
2. ChatPanel.
3. Message rendering components.
4. messagePresentation.ts.
5. Existing pagination hooks.
6. WebSocket subscriptions.
7. Message deduplication.
8. Smart scrolling.
9. Read-cursor tracking.
10. Image loading.
11. Reaction updates.
12. Typing and presence.
13. Existing tests.

Known historical implementation details:
- Message IDs are stable Long identifiers.
- Message rows use data-message-id.
- Message ordering uses createdAt and id.
- Web deduplicates messages by messageId.
- Conversation navigation previously caused flicker and was stabilized.

Verify these details against the current repository.

## 8. Initial Audit Report

Before modifying code, summarize:

- Current message pagination strategy.
- Current message rendering strategy.
- Current scroll management.
- Current WebSocket subscription lifecycle.
- Current image-loading strategy.
- Current read-cursor logic.
- Existing database indexes.
- Suspected or measured bottlenecks.
- Proposed changes.
- Expected files to modify.

Distinguish confirmed problems from hypotheses.

---

# PART C — PERFORMANCE BASELINE

## 9. Representative Test Data

Test conversations with:

- 100 messages.
- 1,000 messages.
- 5,000 messages.

Include mixed content when supported:
- Text messages.
- Replies.
- Reactions.
- Images.

Use development-only fixtures or test utilities.

Do not insert fake messages into production data.

Do not add demo data to normal application startup.

## 10. Performance Measurements

Measure where tools are available:

Web:
- Number of mounted message DOM nodes.
- React render/commit behavior.
- Time to display initial message page.
- Time to prepend older messages.
- Scroll position stability.
- Browser memory behavior.
- Number of network requests.

Backend:
- Message query duration.
- Database query count.
- Pagination query behavior.
- N+1 query patterns.
- Query plans where possible.

Use browser profiling or test instrumentation only when available.

Do not invent performance measurements.

Document baseline results.

---

# PART D — MESSAGE RENDERING

## 11. Efficient Message Rendering

Review current rendering behavior.

Requirements:
- Stable React keys based on messageId.
- Correct chronological ordering.
- No duplicate message rows.
- Preserve sender grouping.
- Preserve Reply previews.
- Preserve Reactions.
- Preserve image bubbles.
- Preserve timestamps.
- Preserve data-message-id attributes.

Avoid unnecessary rerenders of unchanged messages.

Possible improvements:
- React.memo for stable message rows.
- Stable callbacks.
- Memoized derived message data.
- Smaller component state boundaries.

Apply only when justified.

Do not add memoization everywhere.

## 12. Long Conversation Handling

A conversation containing thousands of persisted messages must not require loading all messages immediately.

Requirements:
- Load an initial bounded page.
- Load older messages on demand.
- Keep network payloads bounded.
- Avoid rendering unbounded history.
- Preserve normal scrolling.

If accumulated DOM nodes become a measured bottleneck, evaluate windowing or virtualization.

Do not introduce virtualization automatically.

If virtualization is needed:
- Support variable-height messages.
- Preserve image aspect ratios.
- Preserve read visibility tracking.
- Preserve scroll anchoring.
- Preserve accessibility.
- Preserve message actions and Reply.

Use a maintained, compatible library only when clearly justified.

## 13. Avoid Unnecessary Rerenders

Inspect whether these events cause full message-list rerenders:
- Typing updates.
- Presence updates.
- Reaction updates.
- New incoming messages.
- Conversation-list changes.
- Friend status changes.

Separate state or component boundaries where useful.

Do not rewrite the entire state-management architecture.

---

# PART E — MESSAGE PAGINATION

## 14. Pagination Audit

Inspect the existing REST message pagination.

Requirements:
- Stable ordering by createdAt and id.
- Bounded page size.
- Correct page boundaries.
- No missing messages.
- No duplicate messages.
- Correct handling of identical timestamps.
- Correct behavior when new messages arrive.

Prefer existing cursor/keyset pagination if correct.

Avoid expensive large OFFSET queries where an efficient cursor strategy is available.

Do not break existing clients.

## 15. Initial Message Loading

When opening a conversation:
- Load only the latest bounded page.
- Render messages in chronological order.
- Avoid unnecessary repeated fetches.
- Avoid blank-screen flicker.
- Preserve active conversation selection.
- Handle network failures.

Do not reload the entire conversation after every new message.

## 16. Load Older Messages

When the user scrolls upward:
- Load the next older page.
- Preserve the visible viewport.
- Prevent duplicate requests.
- Deduplicate by messageId.
- Maintain correct ordering.
- Show subtle loading feedback.
- Stop requesting when history is exhausted.
- Allow retry after failure.

Do not jump to the bottom after prepending messages.

## 17. Concurrent Pagination and Realtime

Test:
- User loads older messages.
- Another user sends a new message.
- The older page arrives after the realtime event.

Requirements:
- No message loss.
- No duplicate messages.
- No incorrect ordering.
- No unexpected scrolling.
- No corrupted pagination cursor.

Use stable reconciliation rules.

## 18. Conversation Switching

When switching between conversations:
- Cancel or ignore stale history responses.
- Avoid applying results to the wrong conversation.
- Avoid duplicate WebSocket subscriptions.
- Avoid unnecessary remounts.
- Preserve intended draft behavior.
- Preserve unread state.
- Avoid layout flicker.

Do not reintroduce previously fixed navigation dependency problems.

---

# PART F — SCROLLING OPTIMIZATION

## 19. Smart Auto-scroll

Auto-scroll only when appropriate.

Expected behavior:
- If user is near the bottom, new messages may keep the view at the bottom.
- If user is reading older messages, do not force-scroll.
- If user sends a message, preserve the existing intended send-and-scroll behavior.
- If user receives a message while scrolled up, show the existing new-message indicator if available.

Avoid global forced scrolling.

## 20. Scroll Anchoring

When older messages are prepended:
- Record a stable visible anchor or equivalent viewport reference.
- Restore the anchor after rendering.
- Account for variable-height content.
- Avoid visible jumps.

Do not rely solely on arbitrary timeouts.

Use the appropriate React rendering lifecycle.

## 21. Image Layout Stability

If image messages are implemented:
- Reserve space using image dimensions.
- Avoid layout shifts during loading.
- Preserve scroll position when images finish loading.
- Use lazy loading where appropriate.
- Preserve secure image access.
- Avoid leaking JWT tokens.
- Clean up object URLs.

Do not replace private image retrieval with public URLs.

## 22. Typing and Reactions

Ensure:
- Typing indicators do not repeatedly shift the message viewport.
- Reaction changes do not trigger unnecessary scrolling.
- Reply previews do not destabilize message heights unexpectedly.
- Theme changes do not corrupt scroll position.

Respect reduced-motion preferences.

---

# PART G — REALTIME OPTIMIZATION

## 23. WebSocket Subscription Lifecycle

Inspect:
- Connection establishment.
- Subscription creation.
- Conversation switching.
- Reconnect handling.
- Component cleanup.

Requirements:
- No duplicate subscriptions.
- No stale subscriptions.
- No duplicate message events.
- No unnecessary reconnects.
- No memory leaks.

Preserve existing security behavior.

## 24. Message Deduplication

Use stable messageId-based reconciliation.

Handle:
- Optimistic message state.
- Persisted server response.
- WebSocket echo.
- Reconnect replay, if applicable.
- REST history overlap.

Do not display the same persisted message twice.

## 25. Reaction Event Consistency

If reactions exist:
- Preserve authoritative reaction state.
- Ignore stale updates where versioning supports it.
- Handle duplicate events safely.
- Avoid rerendering unrelated message rows.
- Avoid full-history reload after each reaction.

Do not assume ephemeral typing event IDs provide reaction ordering guarantees.

## 26. Typing and Presence Performance

Typing and presence are ephemeral.

Requirements:
- Avoid excessive state updates.
- Avoid duplicate timers.
- Clean up timers and subscriptions.
- Avoid unrelated chat rerenders.
- Preserve existing expiry behavior.
- Preserve reconnect behavior.

Do not introduce Redis for this milestone.

---

# PART H — BACKEND PERFORMANCE

## 27. Query Audit

Inspect actual query behavior for:
- Message history.
- Reply previews.
- Reaction summaries.
- Attachment metadata.
- Sender information.
- Conversation membership.

Identify N+1 queries.

Prefer batched loading where needed.

Do not introduce complex caching without evidence.

## 28. Pagination Query Optimization

Ensure:
- Correct composite ordering.
- Bounded result size.
- Appropriate filtering by conversationId.
- Efficient cursor conditions.
- Correct tie-breaking by id.

Review query plans when possible.

Avoid loading all messages into memory to paginate in Java.

## 29. Index Review

Inspect existing indexes.

Potentially relevant:
- conversation_id.
- created_at.
- message_id.
- reaction message_id.
- attachment message_id.

Do not duplicate indexes.

If a new index is justified:
- Create a new Flyway migration.
- Explain the query it supports.
- Validate migration execution.
- Preserve existing data.

## 30. API Payload Efficiency

Review message DTO payloads.

Avoid:
- Unnecessary repeated data.
- Binary image content in JSON.
- Unbounded nested structures.
- Excessive per-message metadata requests.

Preserve existing contracts.

Do not remove fields required by existing clients.

---

# PART I — CORRECTNESS & REGRESSION

## 31. Read-Cursor Safety

This is a critical requirement.

Preserve:
- Monotonic read-cursor semantics.
- Correct active-conversation behavior.
- Hidden-tab safety.
- Visibility-based read tracking.
- No marking unseen messages as read.
- No advancing through unloaded history gaps.
- Correct behavior during pagination.
- Correct behavior during realtime arrivals.

Preserve data-message-id attributes.

Do not mark messages read simply because an API returned them.

## 32. DIRECT and GROUP Compatibility

Verify:
- DIRECT chat.
- GROUP chat.
- Group membership changes.
- Group deletion.
- Conversation switching.
- Existing authorization.

Performance optimizations must not bypass authorization.

## 33. Nearby and Friends Regression

PROMPT_036 and PROMPT_037 are confirmed complete.

Ensure messaging optimizations do not break:
- Nearby profile-to-chat navigation.
- Friends list-to-chat navigation.
- Friend request actions.
- Existing DIRECT conversation reuse.
- Friends + Chat desktop layout.

Do not refactor Nearby or Friends unnecessarily.

---

# PART J — TESTING

## 34. Backend Tests

Test:
1. Stable message ordering.
2. Identical timestamps.
3. Pagination boundaries.
4. No duplicate pages.
5. Concurrent message insertion.
6. Conversation authorization.
7. Reply preview loading.
8. Reaction summary loading.
9. Attachment metadata loading.
10. Group membership authorization.
11. Read-cursor behavior.
12. Large-history query behavior.

Only test features actually present.

## 35. Web Tests

Test:
1. Initial chat loading.
2. Long conversation rendering.
3. Older-message pagination.
4. Scroll anchoring.
5. Realtime messages during pagination.
6. Duplicate WebSocket events.
7. Optimistic message reconciliation.
8. Conversation switching.
9. Image loading.
10. Reaction updates.
11. Typing indicator updates.
12. Presence updates.
13. Unread/read behavior.
14. Hidden-tab behavior.
15. Reconnect handling.
16. Theme compatibility.
17. Responsive layout.
18. Nearby-to-chat navigation.
19. Friends-to-chat navigation.

## 36. Manual Verification

Use at least two accounts.

Scenario A — Long History:
- Open a conversation with 1,000+ messages.
- Verify initial bounded loading.
- Scroll upward repeatedly.
- Verify stable pagination and viewport.

Scenario B — Realtime:
- A reads older messages.
- B sends a new message.
- A should not be forced to the bottom.
- The new message remains available.

Scenario C — Images:
- Open a conversation with multiple images.
- Load older history.
- Verify no major layout jumps.

Scenario D — Reactions:
- React to a message.
- Verify only relevant UI updates.
- Verify consistency between two accounts.

Scenario E — Navigation:
- Switch between multiple conversations.
- Verify no stale messages or duplicate subscriptions.

Scenario F — Read State:
- Receive unread messages.
- Load older history.
- Verify unread counters remain correct.

Scenario G — Responsive:
- Test at 375px.
- Test at 768px.
- Test at 1440px.

Do not claim manual verification unless performed.

## 37. Validation Commands

Inspect actual repository scripts.

Run:
- Web production build.
- Web tests.
- Web typecheck/lint if available.
- Relevant Backend tests using Maven Wrapper.

If database migrations are introduced:
- Validate Flyway against PostgreSQL/PostGIS.

Report actual command results.

Do not run Mobile tests.

---

# PART K — IMPLEMENTATION PHASES

## 38. Phase 1 — Audit and Baseline

- Inspect existing architecture.
- Identify bottlenecks.
- Establish representative test scenarios.
- Record available baseline measurements.
- Select minimal optimizations.

## 39. Phase 2 — Web Rendering

- Reduce unnecessary rerenders.
- Preserve stable message keys.
- Improve long-history rendering if needed.
- Add tests.

## 40. Phase 3 — Pagination and Scrolling

- Fix verified pagination issues.
- Improve viewport anchoring.
- Handle concurrent realtime updates.
- Add tests.

## 41. Phase 4 — Realtime and Images

- Verify subscription lifecycle.
- Improve deduplication.
- Optimize image loading.
- Preserve reaction consistency.
- Add tests.

## 42. Phase 5 — Backend

- Optimize verified slow queries.
- Fix N+1 patterns.
- Add justified indexes only.
- Add tests.

## 43. Phase 6 — Regression

- Run Backend tests.
- Run Web build and tests.
- Compare available measurements.
- Verify Nearby and Friends integrations.
- Document remaining limitations.

Complete each phase before proceeding.

---

# PART L — ACCEPTANCE CRITERIA

## 44. Completion Checklist

PROMPT_038 is complete when:

- [ ] Existing DIRECT and GROUP chat remain functional.
- [ ] Initial history loading is bounded.
- [ ] Large conversations remain responsive under representative tests.
- [ ] Pagination ordering is deterministic.
- [ ] No missing or duplicate messages occur at page boundaries.
- [ ] Scroll position is preserved when loading older messages.
- [ ] Incoming messages do not force unwanted scrolling.
- [ ] Conversation switching does not produce stale messages.
- [ ] WebSocket subscriptions are cleaned up correctly.
- [ ] Image loading avoids unnecessary layout shifts.
- [ ] Reactions remain consistent.
- [ ] Typing/presence do not cause excessive rerenders.
- [ ] Read-cursor correctness is preserved.
- [ ] Backend queries remain bounded.
- [ ] Performance changes have evidence or documented justification.
- [ ] Relevant Backend tests pass.
- [ ] Web build and tests pass.
- [ ] Nearby-to-chat navigation remains functional.
- [ ] Friends-to-chat navigation remains functional.
- [ ] Mobile source remains unchanged.

## 45. Final Report

Provide a Vietnamese report containing:

1. Initial architecture audit.
2. Identified bottlenecks.
3. Baseline measurements, where available.
4. Implemented changes.
5. Files modified.
6. Before/after performance comparison.
7. Backend query improvements.
8. Web rendering improvements.
9. Pagination and scrolling improvements.
10. WebSocket improvements.
11. Backend test results.
12. Web build/test results.
13. Manual verification actually performed.
14. Regression results.
15. Mobile compatibility assessment.
16. Known limitations.
17. Recommended next milestone.

Clearly distinguish:
- Measured improvements.
- Expected improvements not yet measured.
- Areas left unchanged.

End with exactly one of:

PROMPT_038 COMPLETE

or

PROMPT_038 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.