# PROMPT_037 — GeoChat Friend Discovery & Connection UX

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS.
- Security: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Development postponed.

Confirmed milestone:
- PROMPT_036 — Nearby Discovery & Map UX: COMPLETED.

Earlier milestones include:
- Friend management and DIRECT chat foundations.
- GROUP chat and conversation management.
- Unread/read state.
- Typing and presence.
- Reply/reactions, where implemented.
- Image sharing, where implemented.

Inspect the repository to verify the actual implementation.

Do not assume a feature exists merely because it appeared in a previous prompt.

## 2. Primary Objective

Improve the complete friend discovery and connection experience.

Users should be able to:
1. Find other users.
2. View limited public profiles.
3. Send friend requests.
4. Cancel outgoing requests.
5. Accept incoming requests.
6. Reject incoming requests.
7. Manage existing friends.
8. Remove friends with confirmation.
9. Start or reopen DIRECT conversations.
10. Move naturally between Nearby, Friends, Profile and Chat.

The experience must be consistent, responsive, secure and easy to understand.

Do not build a separate social network system.

---

# PART A — MANDATORY RULES

## 3. Web-first

Prioritize:
- UI/UX.
- Responsive design.
- User interaction.
- Consistent friend relationship states.
- Navigation.
- Error handling.
- Accessibility.

Backend changes are allowed only when needed to support the Web.

## 4. Mobile — Strictly Excluded

- Do not modify Mobile source.
- Do not implement Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Preserve existing Mobile-facing APIs whenever reasonable.

## 5. Architecture Constraints

- Preserve the modular monolith.
- Reuse the existing friend module.
- Reuse the existing user module.
- Reuse the existing chat module.
- Reuse Nearby integration from PROMPT_036.
- Preserve existing REST contracts.
- Preserve existing WebSocket destinations.
- Avoid unnecessary database migrations.
- Avoid large refactoring.
- Avoid introducing Redis or new infrastructure.
- Do not hardcode demo users.

---

# PART B — REPOSITORY AUDIT

## 6. Inspect Before Coding

Backend:
1. Friend entity and repository.
2. Friend request entity and statuses.
3. FriendController and FriendService.
4. UserController and UserService.
5. Existing user search APIs.
6. Existing profile DTOs.
7. Existing DIRECT conversation APIs.
8. Friend authorization rules.
9. Existing notification mechanisms.
10. Blocking/privacy rules, if implemented.
11. Database indexes and migrations.

Web:
1. Friends page.
2. Existing 4/6 Friends + Chat layout.
3. Friend list components.
4. Incoming/outgoing request UI.
5. Nearby user cards.
6. Profile page or modal.
7. DIRECT chat navigation.
8. Shared API clients.
9. Theme tokens.
10. Responsive layouts.
11. Existing tests.

Important:
PROMPT_027 introduced a Facebook-like Friends layout with approximately 40% friend list and 60% message content.

Preserve or improve this layout rather than replacing it unnecessarily.

Before coding, summarize:
- Existing friend functionality.
- Existing search functionality.
- Current relationship statuses.
- Missing UI actions.
- Missing Backend capabilities.
- Proposed files to modify.
- Compatibility risks.

Do not duplicate existing features.

---

# PART C — FRIEND DISCOVERY

## 7. Find People

Provide a dedicated user discovery experience within the existing Friends interface.

Allow users to search by:
- Display name.
- Username, if supported by the existing user model.

Do not introduce public email or phone-number search unless already explicitly supported by product privacy rules.

Requirements:
- Case-insensitive search.
- Trim surrounding whitespace.
- Support Vietnamese Unicode.
- Debounced input.
- Bounded result count.
- Paginated results where appropriate.
- No duplicate users.
- Exclude the current user.
- Respect existing privacy/blocking rules.

Do not fetch the entire user database to filter on the client.

## 8. Search Results

Each result should show:
- Avatar.
- Display name.
- Username, if public.
- Friendship status.
- Appropriate action button.

Possible actions:
- Add Friend.
- Request Sent.
- Accept Request.
- Message, for existing friends.
- View Profile.

Do not show:
- Private email.
- Private phone number.
- Exact location.
- Hidden profile fields.

Use existing design tokens.

## 9. Search Behavior

Requirements:
- Debounce search around 300ms.
- Cancel or ignore stale requests.
- Clear results when the query changes.
- Avoid duplicate API calls.
- Handle empty queries.
- Handle network errors.
- Provide useful empty states.

Do not show all registered users automatically unless the existing product design explicitly allows that behavior.

---

# PART D — FRIEND REQUEST WORKFLOW

## 10. Relationship State Model

Inspect existing Backend relationship statuses.

Map Backend statuses to consistent Web UI states.

Expected conceptual states:
- NONE.
- OUTGOING_PENDING.
- INCOMING_PENDING.
- FRIENDS.

These are conceptual names, not mandatory database enum values.

Reuse existing statuses.

Do not introduce duplicate friendship records or conflicting status models.

## 11. Send Friend Request

Requirements:
- Authenticated user can send a request to an eligible user.
- Cannot send request to self.
- Cannot create duplicate pending requests.
- Cannot send request to an existing friend.
- Respect existing privacy/blocking rules.
- Update UI after success.
- Handle conflicts gracefully.

Do not use optimistic updates that permanently hide Backend failures.

## 12. Cancel Outgoing Request

Allow users to cancel their own pending requests.

Requirements:
- Only the sender can cancel.
- Already accepted requests cannot be canceled as pending.
- Update the relevant UI state.
- Preserve Backend consistency.

Reuse existing API if available.

## 13. Accept Incoming Request

Requirements:
- Only the recipient can accept.
- Friendship becomes established atomically.
- Duplicate accept attempts are safe.
- Update incoming requests.
- Update friend list.
- Update user search results.
- Update Nearby relationship state when applicable.

Do not create duplicate friendship relationships.

## 14. Reject Incoming Request

Requirements:
- Only the recipient can reject.
- Remove or update the pending request according to existing data rules.
- Do not automatically block the sender.
- Update UI without a full page reload.

## 15. Crossed Friend Requests

Handle the case where:
- User A sends a request to B.
- User B attempts to send a request to A.

Follow existing Backend rules.

Prefer a single consistent pending or accepted relationship rather than duplicate reverse requests.

Do not silently invent new friendship semantics.

Add regression tests for concurrent actions.

---

# PART E — FRIENDS MANAGEMENT UI

## 16. Friends Page Organization

Improve the existing Friends page.

Suggested sections:
- All Friends.
- Friend Requests.
- Find People.

For Friend Requests:
- Received.
- Sent.

Use tabs or segmented navigation consistent with the current design.

Preserve the existing Friends + Chat split layout where appropriate.

Do not create unnecessary new routes.

## 17. Friend List

Each friend item should display:
- Avatar.
- Display name.
- Presence indicator, if implemented.
- Last interaction preview, if already available.
- Message action.

Do not fabricate online status.

Do not trigger expensive per-friend queries.

Support searching/filtering the user's existing friends locally when the list size is reasonable.

## 18. Remove Friend

Allow removing an existing friend.

Requirements:
- Show confirmation.
- Clearly identify the user being removed.
- Update friend list after success.
- Update search/Nearby relationship state.
- Respect existing Backend authorization.

Important:
Inspect the current product rules regarding DIRECT conversation history after unfriending.

Do not automatically delete message history unless the existing specification requires it.

Do not invent a new chat retention policy.

## 19. Friend Request Counters

Display a pending incoming request count when supported.

Requirements:
- Use authoritative Backend data.
- Keep count consistent after accept/reject.
- Avoid duplicate counting.
- Avoid excessive polling.

If realtime notifications already exist, reuse them.

Do not introduce a new WebSocket system solely for friend request counters.

## 20. Empty States

Provide useful states:
- No friends yet.
- No incoming requests.
- No outgoing requests.
- No matching users.
- Search failed.

Each state should include an appropriate next action.

Avoid fake data.

---

# PART F — PROFILE & NAVIGATION

## 21. Public Profile Preview

Allow viewing a user's public profile from:
- Find People.
- Friends list.
- Nearby results.

Reuse existing profile components where possible.

Show only authorized fields.

Do not expose:
- Private contact information.
- Precise location.
- Sensitive account details.

## 22. Relationship Actions on Profile

Show context-sensitive actions:
- Add Friend.
- Cancel Request.
- Accept Request.
- Message.
- Remove Friend, where appropriate.

Ensure the action state is consistent with the Friends page and Nearby page.

Avoid multiple independently maintained relationship-state implementations.

## 23. Open DIRECT Conversation

When clicking Message:
- Reuse an existing DIRECT conversation if present.
- Otherwise use the existing authorized create/open workflow.
- Navigate to the correct conversation.
- Avoid duplicate DIRECT conversations.
- Preserve current chat state conventions.

Do not bypass friendship requirements.

## 24. Friends + Chat Layout

Preserve the existing 4/6 layout on desktop where appropriate.

Requirements:
- Stable sidebar width.
- Stable message panel.
- No unnecessary remounting.
- No conversation flicker.
- No layout jumps.
- Correct active friend selection.

On smaller screens:
- Use a responsive list/detail flow.
- Preserve Back navigation.
- Avoid horizontal overflow.

Do not redesign the entire messaging application.

---

# PART G — BACKEND & SECURITY

## 25. Backend APIs

Reuse existing friend and user APIs.

Only add or extend endpoints for missing required functionality.

Possible capabilities:
- Search users.
- List friends.
- List incoming requests.
- List outgoing requests.
- Send request.
- Cancel request.
- Accept request.
- Reject request.
- Remove friend.
- Retrieve relationship state.

Use existing naming conventions.

Do not create duplicate endpoints if suitable ones already exist.

## 26. Authorization

Enforce:
- JWT authentication.
- Request ownership.
- Recipient-only acceptance/rejection.
- Sender-only cancellation.
- Friendship removal authorization.
- Existing privacy and blocking rules.
- Safe public profile visibility.

Do not rely on frontend checks alone.

## 27. Database Consistency

Review:
- Unique constraints.
- Pending request duplication.
- Reverse-direction requests.
- Concurrent accept operations.
- Friendship creation.
- Relationship removal.

Add migrations only when necessary.

Preserve existing data.

Do not modify applied Flyway migrations.

## 28. Performance

Avoid:
- N+1 user profile lookups.
- N+1 friendship status queries.
- Unbounded user searches.
- Repeated friend-list reloads.
- Full conversation reload after a friend action.
- Unnecessary WebSocket subscriptions.

Use bounded queries and appropriate indexes.

Do not add speculative indexes.

## 29. Privacy

Respect:
- Profile visibility.
- Blocking rules if present.
- Nearby discoverability settings.
- Existing account privacy preferences.

Important:
Nearby discoverability and global user search are different concepts.

Do not automatically expose users in Nearby because they appear in Find People.

Do not reveal precise coordinates through friend discovery.

---

# PART H — TESTING

## 30. Backend Tests

Test:
1. User search.
2. Case-insensitive matching.
3. Vietnamese Unicode matching.
4. Self-exclusion.
5. Pagination.
6. Unauthorized search.
7. Send friend request.
8. Duplicate request prevention.
9. Self-request rejection.
10. Cancel outgoing request.
11. Accept incoming request.
12. Reject incoming request.
13. Unauthorized acceptance.
14. Unauthorized cancellation.
15. Crossed requests.
16. Concurrent acceptance.
17. Remove friend.
18. Relationship state accuracy.
19. DIRECT conversation reuse.
20. Privacy and blocking behavior.

## 31. Web Tests

Test:
1. Find People UI.
2. Debounced search.
3. Stale response handling.
4. Search empty state.
5. Send request.
6. Cancel request.
7. Accept request.
8. Reject request.
9. Friend list updates.
10. Remove confirmation.
11. Relationship state synchronization.
12. Profile navigation.
13. DIRECT chat navigation.
14. Existing 4/6 layout.
15. Responsive behavior.
16. Light/Dark themes.
17. Keyboard accessibility.
18. Error recovery.

## 32. Manual Verification

Use two test accounts.

Scenario A:
- A searches for B.
- A sends a friend request.
- B sees the incoming request.
- B accepts.
- Both users appear as friends.

Scenario B:
- A sends a request.
- A cancels it.
- B no longer has an actionable pending request.

Scenario C:
- A and B become friends.
- A opens chat with B.
- Existing DIRECT conversation is reused.

Scenario D:
- A removes B.
- Friend lists and relationship actions update.
- Existing message history follows current retention rules.

Scenario E:
- Test the same user relationship through Friends, Profile and Nearby.
- Verify consistent status.

Scenario F:
- Test 375px, 768px and 1440px.
- Verify responsive list/detail behavior.

## 33. Regression Checklist

Verify:
- Authentication.
- Logout.
- Nearby discovery.
- Nearby privacy.
- Map/List views.
- Radius filtering.
- Friend requests.
- DIRECT chat.
- GROUP chat.
- Group management.
- Unread/read state.
- Typing and presence.
- Reply/reactions if implemented.
- Image sharing if implemented.
- Theme switching.
- Responsive navigation.

Do not run Mobile tests.

## 34. Validation

Inspect repository scripts and run:
- Web production build.
- Existing Web tests.
- Web typecheck/lint if available.
- Relevant Backend tests using Maven Wrapper.

Report actual results.

Do not claim manual browser testing unless performed.

---

# PART I — IMPLEMENTATION PLAN

## 35. Phase 1 — Audit

- Inspect existing friend workflows.
- Inspect Friends page.
- Inspect Nearby integration.
- Identify missing actions.
- Identify compatibility risks.

## 36. Phase 2 — Backend Gaps

- Implement only missing APIs.
- Strengthen authorization.
- Ensure relationship consistency.
- Add tests.

## 37. Phase 3 — Friend Discovery UI

- Implement or improve Find People.
- Add search results.
- Add relationship actions.
- Add loading/empty/error states.

## 38. Phase 4 — Friend Management

- Improve Friends list.
- Improve incoming/outgoing requests.
- Add removal confirmation.
- Synchronize relationship states.

## 39. Phase 5 — Navigation

- Integrate profile preview.
- Integrate DIRECT chat.
- Preserve 4/6 layout.
- Ensure responsive navigation.

## 40. Phase 6 — Regression

- Run Backend tests.
- Run Web build/tests.
- Verify Nearby compatibility.
- Verify chat compatibility.
- Document remaining limitations.

---

# PART J — ACCEPTANCE CRITERIA

## 41. Completion Checklist

PROMPT_037 is complete when:

- [ ] Find People works with real Backend data.
- [ ] Search is case-insensitive.
- [ ] Search results are bounded.
- [ ] Private user information is not exposed.
- [ ] Friend requests can be sent.
- [ ] Outgoing requests can be canceled.
- [ ] Incoming requests can be accepted.
- [ ] Incoming requests can be rejected.
- [ ] Duplicate friendships are prevented.
- [ ] Friend lists update correctly.
- [ ] Friend removal works with confirmation.
- [ ] Relationship states are consistent across Friends, Profile and Nearby.
- [ ] DIRECT chat navigation works.
- [ ] Existing DIRECT conversations are reused.
- [ ] Desktop 4/6 layout remains functional.
- [ ] Responsive layouts work.
- [ ] Light/Dark themes work.
- [ ] Authorization tests pass.
- [ ] Relevant Backend tests pass.
- [ ] Web build and tests pass.
- [ ] Mobile source remains unchanged.

## 42. Final Report

Provide a Vietnamese report containing:

1. Existing architecture audit.
2. Reused functionality.
3. New Backend functionality.
4. New Web functionality.
5. Friend relationship state handling.
6. Friends/Nearby/Profile integration.
7. Files modified.
8. Database migrations, if any.
9. Backend test results.
10. Web build/test results.
11. Manual verification actually performed.
12. Regression results.
13. Known limitations.
14. Recommended next milestone.

Clearly distinguish:
- Implemented and tested.
- Implemented but not manually verified.
- Not implemented.

End with exactly one of:

PROMPT_037 COMPLETE

or

PROMPT_037 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.