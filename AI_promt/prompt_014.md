# PROMPT 014 — Mobile Friend UI

## Context

GeoChat is a beginner-friendly but technically grounded mobile + web application.

Previous milestones already implemented:

- Authentication
- User management
- Current location
- Nearby users
- User search
- Friend backend foundation
- Direct chat backend
- WebSocket chat
- Notification backend
- Mobile authentication foundation
- Mobile Home
- Mobile User Search
- Mobile Nearby Users

PROMPT 013 is complete.

The backend Friend functionality from PROMPT 007 already exists.

Do NOT rebuild Friend backend functionality unless the existing implementation is genuinely missing something required by the mobile client.

---

# Goal

Implement the first complete Friend experience in the mobile app.

The mobile user should be able to:

1. Open a Friends screen.
2. View current friends.
3. View incoming friend requests.
4. View outgoing friend requests.
5. Send a friend request from User Search.
6. Accept an incoming friend request.
7. Reject an incoming friend request.
8. Cancel an outgoing friend request.
9. Refresh friend-related data.
10. See appropriate loading, empty, success, and error states.

Keep the implementation simple and beginner-friendly.

Do NOT implement Chat UI in this milestone.

---

# IMPORTANT — Inspect Before Coding

Before modifying code:

1. Inspect the current mobile implementation.
2. Inspect the existing navigation structure.
3. Inspect the API layer created in PROMPT 012/013.
4. Inspect the actual backend Friend APIs.
5. Inspect the actual backend DTOs and response fields.
6. Inspect the existing User Search implementation.
7. Inspect the existing authentication handling.

Do NOT assume endpoint names or DTO field names.

Use the actual backend implementation as the source of truth.

Do NOT create duplicate API clients or duplicate auth logic.

---

# Fixed Technology Constraints

Keep the existing mobile technology stack.

Expected:

- React Native
- Expo
- TypeScript

Do NOT migrate frameworks.

Do NOT introduce a large state-management library.

Do NOT add Redux/Zustand/MobX/TanStack Query unless the project already uses one.

Reuse the existing:

- API client
- JWT handling
- secure storage
- auth provider
- navigation
- UI conventions

---

# 1. Friends Screen

Create:

```text
FriendsScreen
```

The screen should provide access to:

- Friends
- Incoming Requests
- Outgoing Requests

The exact UI can use:

- tabs
- segmented controls
- sections
- navigation to sub-screens

Choose the simplest approach that matches the existing navigation/UI architecture.

Conceptually:

```text
Friends

[ Friends ] [ Requests ] [ Sent ]

Friends
----------------
Alice
Bob
Charlie
```

Do not create a complicated social-network UI.

---

# 2. Friend List

Use the existing backend Friend API to load the authenticated user's friends.

Inspect the actual endpoint first.

Display only public fields exposed by the backend.

Possible conceptual result:

```text
Alice
@alice

Bob
@bob
```

Do not assume the exact fields.

Do NOT display:

- password
- password hash
- JWT
- private/internal information
- raw location coordinates
- unnecessary database IDs

---

# 3. Incoming Friend Requests

Display friend requests received by the current user.

Each request should provide actions:

```text
Alice
[ Accept ] [ Reject ]
```

Use the actual backend endpoints.

When Accept succeeds:

- remove the request from Incoming Requests
- update the Friends list when appropriate
- show a success indication

When Reject succeeds:

- remove the request from Incoming Requests
- show a success indication

Do not require a full app reload.

---

# 4. Outgoing Friend Requests

Display requests sent by the current user.

Example:

```text
Bob
@bob

[ Cancel ]
```

When Cancel succeeds:

- remove the request from the outgoing list
- update the UI immediately after confirmed API success
- show appropriate feedback

Do not implement automatic retry loops.

---

# 5. Send Friend Request From User Search

Integrate Friend functionality into the existing User Search screen from PROMPT 013.

When viewing a search result, determine the user's current relationship state if the backend exposes it.

Possible states:

```text
Add Friend
Request Sent
Friends
```

Use the actual backend response/state model.

If the User Search API does not expose relationship status, inspect the existing Friend APIs before deciding how to determine the state.

Do NOT make a large number of API calls per search result.

Avoid N+1 request behavior.

---

# 6. Send Friend Request

When the user selects Add Friend:

1. Call the existing Friend request API.
2. Show loading state for that specific action.
3. Prevent duplicate submission.
4. On success, update the result state to something equivalent to:

```text
Request Sent
```

5. Show a small success message if the existing UI architecture supports it.

Handle common errors such as:

- already friends
- request already exists
- cannot send request to yourself
- target user does not exist
- unauthorized
- server error

Use the actual backend error contract where available.

Do not duplicate backend business rules in the mobile app.

---

# 7. Friend State Handling

The UI should distinguish at least these states where supported by the backend:

```text
SELF
FRIEND
INCOMING_REQUEST
OUTGOING_REQUEST
NONE
```

Do not invent states that do not exist in the backend.

If the backend represents these states differently, adapt the mobile view model to the actual API contract.

Keep relationship-state mapping in one place rather than scattering conditions throughout multiple components.

---

# 8. API Layer

Create/reuse a typed Friend API service.

Conceptually:

```text
friendApi.ts
```

Possible methods:

```text
sendFriendRequest(...)
acceptFriendRequest(...)
rejectFriendRequest(...)
cancelFriendRequest(...)
getFriends(...)
getIncomingRequests(...)
getOutgoingRequests(...)
```

The exact method names are flexible.

The endpoint paths and request/response structures MUST match the existing backend.

Do not call `fetch()` or the HTTP client directly from UI components if the project already has an API abstraction.

---

# 9. TypeScript Types

Create or reuse types for:

- Friend
- Friend Request
- Friend Request status
- Friend API responses
- relationship state

Do not use `any`.

Do not duplicate the same API type in multiple screens.

Keep API response types separate from UI state when appropriate.

---

# 10. Loading States

Each operation should have a clear loading state.

Examples:

```text
Loading friends...
Loading requests...
Sending request...
Accepting...
Rejecting...
Cancelling...
```

For list loading:

- show a screen/list loading state.

For individual actions:

- show loading only on the affected item/button where practical.

Do not freeze the entire screen unnecessarily when accepting one request.

Prevent duplicate taps while an action is running.

---

# 11. Empty States

Implement clear empty states.

### No Friends

```text
You don't have any friends yet.
```

### No Incoming Requests

```text
No incoming friend requests.
```

### No Outgoing Requests

```text
No outgoing friend requests.
```

Do not treat empty lists as errors.

---

# 12. Error Handling

Handle:

- network error
- unauthorized
- forbidden
- validation error
- request no longer exists
- duplicate request
- already friends
- server error

Use the project's existing error handling pattern.

Do not expose raw server stack traces to users.

Prefer concise messages.

If the backend returns a known business error message/code, map it appropriately.

---

# 13. Refresh

Friends-related screens should support refresh.

At minimum:

- pull-to-refresh if already supported by the project's UI patterns
- or a simple Refresh action

Refreshing should reload the relevant backend data.

Do not implement background polling.

Do not implement realtime friend updates in this milestone.

---

# 14. Navigation

Integrate Friends into the authenticated navigation.

The authenticated user should be able to reach:

```text
Home
├── Search Users
├── Nearby Users
└── Friends
```

Use the existing navigation system.

Do not replace the navigation library.

Unauthenticated users must not access Friends.

---

# 15. Home Screen Integration

Add a simple entry point to Friends from Home.

For example:

```text
[ Friends ]
```

Optionally show a request count if the backend/API already makes this simple.

Do NOT implement a complex notification badge system.

Do NOT introduce a separate notification system just for friend requests.

---

# 16. User Search Integration

Update the User Search screen from PROMPT 013.

Each user result should display an appropriate relationship action.

Conceptually:

```text
Alice
@alice

[ Add Friend ]
```

or:

```text
Alice
@alice

[ Request Sent ]
```

or:

```text
Alice
@alice

[ Friends ]
```

The exact appearance is up to the existing UI style.

Do not allow sending a request to yourself.

If the backend already excludes the current user, still make the UI resilient to the case.

---

# 17. Avoid N+1 Requests

Be careful with relationship status.

Do NOT implement:

```text
search users
→ call friend API once for every result
```

unless there is absolutely no alternative and the result set is tiny.

Prefer using relationship information already provided by the backend.

If the backend currently does not provide relationship information and a small backend enhancement is genuinely required, inspect the existing architecture first and make the smallest compatible change.

If backend changes are needed, explain them clearly in the final report.

---

# 18. State Synchronization

After a successful Friend action, update relevant local UI state.

Examples:

### Accept

```text
Incoming Request
        ↓
Friends
```

### Reject

```text
Incoming Request
        ↓
Removed
```

### Cancel

```text
Outgoing Request
        ↓
Removed
```

### Send

```text
None
  ↓
Request Sent
```

Avoid forcing a complete application reload after every action.

---

# 19. Authentication

All Friend APIs must use the existing authenticated API client.

Do not store JWT manually in Friend screens.

Do not add another token storage mechanism.

If the backend returns unauthorized:

- use the existing authentication/session handling
- do not implement a separate logout mechanism

---

# 20. Tests

Add focused tests using the existing mobile testing setup.

At minimum, cover important behavior.

## Friends list

- friends are loaded
- friends are rendered
- empty state is rendered
- API error is handled

## Incoming requests

- requests are loaded
- Accept calls the correct API
- Reject calls the correct API
- successful Accept updates UI
- successful Reject removes request
- API failure keeps appropriate UI state

## Outgoing requests

- outgoing requests are loaded
- Cancel calls the correct API
- successful Cancel updates UI

## User Search

- Add Friend calls the correct API
- duplicate submission is prevented
- relationship state changes after success
- self cannot receive Add Friend action

## Authentication

Verify existing authenticated navigation still works.

Do not add a new testing framework solely for this milestone.

---

# 21. Manual Verification

If the environment allows manual testing, verify with at least two test accounts.

Use this scenario:

### Account A

1. Login as A.
2. Search for B.
3. Send Friend Request.
4. Confirm UI changes to Request Sent.
5. Open Friends.
6. Confirm request appears under outgoing requests.

### Account B

1. Login as B.
2. Open Friends.
3. Confirm request appears under incoming requests.
4. Accept the request.
5. Confirm it disappears from incoming requests.
6. Confirm A appears in Friends.

### Account A

1. Refresh Friends.
2. Confirm B appears in Friends.

Then test:

- Reject flow
- Cancel flow
- empty lists
- duplicate request handling
- logout/login regression

---

# 22. Backend Compatibility

The mobile implementation must match the existing backend.

Before making any backend changes:

1. Inspect current Friend APIs.
2. Determine whether the required mobile functionality is already supported.
3. Prefer client-only implementation if possible.

If backend changes are unavoidable:

- make the smallest change possible
- preserve existing API behavior
- add/update backend tests
- document the change in the final report

Do NOT refactor the Friend backend module unnecessarily.

---

# 23. Scope Protection

DO NOT implement the following in PROMPT 014:

- Chat UI
- Direct message UI
- WebSocket client
- Notification screen
- Push notifications
- Group chat
- Group UI
- Map
- Background location
- Realtime friend presence
- User profile editing
- Block/report system
- Advanced social graph
- Friend recommendations
- Contact synchronization

Those belong to later milestones.

---

# 24. Regression Protection

Do not break previous functionality.

Verify:

- Register still works.
- Login still works.
- `/me` still works.
- Logout still works.
- Home still works.
- User Search still works.
- Nearby Users still works.
- Location permission flow still works.
- Existing backend tests still pass.
- Existing mobile TypeScript validation still passes.

Do not rewrite working code from PROMPT 012 or PROMPT 013 without a concrete reason.

---

# 25. Validation

Run:

```bash
cd apps/mobile
npx tsc --noEmit
```

Run the existing mobile test command if available.

If backend code was changed:

```bash
cd backend
.\mvnw.cmd test
```

Also run any existing lint/build command used by the project.

Do not report COMPLETE if required validation fails.

---

# 26. Code Quality

Follow existing project conventions.

Prefer:

- small components
- typed API services
- reusable friend-request UI components where useful
- clear relationship-state mapping
- explicit loading/error states
- minimal dependencies
- simple navigation

Avoid:

- unnecessary abstractions
- duplicated API calls
- duplicated relationship logic
- giant components
- `any`
- unrelated refactoring

---

# 27. Final Report

When implementation is complete, report:

## Changed

List:

- Friends screen
- friend list
- incoming requests
- outgoing requests
- send request integration
- relationship-state handling
- navigation changes
- API services
- TypeScript types
- tests

## Backend Changes

Explicitly state:

```text
Backend changed: YES/NO
```

If YES, explain:

- why it was necessary
- which files changed
- which tests were added/updated

## Validation

Report exact commands and results.

Example:

```text
npx tsc --noEmit    PASS
npm test            PASS
.\mvnw.cmd test     PASS
```

Only list commands that were actually executed.

## Manual Verification

Report what was actually tested with the test accounts.

## Scope Check

Confirm that these were NOT implemented:

- Chat UI
- WebSocket client
- Notification UI
- Push notifications
- Group chat
- Map
- Background location
- Realtime friend presence

---

# Completion Rule

Only report:

```text
PROMPT_014 COMPLETE
```

if:

- Friend UI is implemented
- Send/Accept/Reject/Cancel flows work
- Friend list works
- Incoming/outgoing requests work
- User Search integrates Friend actions
- authentication/security is preserved
- tests pass
- TypeScript validation passes
- regression checks pass

Otherwise report:

```text
PROMPT_014 NOT COMPLETE
```

and clearly list:

1. what is incomplete
2. what failed
3. what remains to be fixed

Do not mark the milestone complete just because the application compiles.

# End of PROMPT 014