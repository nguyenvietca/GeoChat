# PROMPT_020 — Web Friends, Direct Chat & Realtime Messaging

## Context

GeoChat Web already has:

- Web foundation
- Authentication
- Login/Register
- Protected routes
- Authenticated Home
- User Search
- Nearby Users
- Central API client
- Central authentication state

The backend already provides:

- Friend system
- Direct chat
- Message persistence
- WebSocket/STOMP realtime messaging
- JWT authentication
- Conversation authorization

The mobile application already implements the corresponding Friend and Direct Chat functionality and can be used as a behavioral reference.

This milestone connects the Web experience:

```text
User Search
     ↓
Friend Request
     ↓
Friendship
     ↓
Friends
     ↓
Open Direct Chat
     ↓
Message History
     ↓
Send Message
     ↓
Realtime WebSocket Message
```

---

# Goal

Implement the Web Friend and Direct Chat experience.

The Web application must support:

## Friends

1. Friends page
2. Friend list
3. Incoming friend requests
4. Outgoing friend requests
5. Send friend request from User Search
6. Accept friend request
7. Reject friend request
8. Cancel outgoing request
9. Correct relationship state

## Direct Chat

10. Conversation list
11. Open direct conversation from a friend
12. Load message history
13. Send text messages
14. Receive realtime messages through existing WebSocket/STOMP backend
15. Reconnect WebSocket when appropriate
16. Avoid duplicate messages
17. Message pagination/load more
18. Correct authorization/error handling
19. Responsive chat UI

Do NOT implement Notifications, Profile, Settings, Group Chat, Media Upload, or Calls.

---

# 1. Inspect Before Coding

Before changing anything, inspect the actual project.

## Backend

Inspect:

### Friend

- Friend controller
- Friend service
- Friend DTOs
- Friend request statuses
- Friend endpoints
- ownership/security rules

### Chat

- Conversation controller
- Conversation service
- Message controller
- Message service
- conversation DTOs
- message DTOs
- pagination behavior
- authorization rules

### WebSocket

Inspect:

- WebSocket configuration
- STOMP endpoint
- JWT authentication
- inbound authorization
- subscription authorization
- send destination
- broadcast destination
- message payload

Confirm the actual contract.

Do NOT assume the endpoint names from this prompt are correct.

---

# 2. Inspect Existing Web Implementation

Inspect:

- API client
- authentication provider/state
- router
- application shell
- Search page
- Nearby page
- reusable components
- styling
- existing WebSocket dependencies, if any

Do not replace the existing frontend architecture.

If a WebSocket/STOMP client library already exists, reuse it.

If not, add only the minimal dependency required by the existing backend protocol.

---

# 3. Inspect Mobile Implementation

Use the existing mobile Friend/Chat implementation as a behavioral reference.

Look for:

- API contracts
- message model
- conversation model
- pagination behavior
- WebSocket connection
- authentication
- reconnect behavior
- duplicate message handling

Do not copy mobile-specific UI architecture into Web.

---

# 4. Fixed Technology Constraints

Keep:

- React
- TypeScript
- Vite
- existing router
- existing API client
- existing auth architecture

Backend remains:

- Java 21
- Spring Boot 4.1.0
- PostgreSQL
- PostGIS
- Flyway
- JWT
- Spring WebSocket/STOMP

Do NOT:

- use Supabase
- replace WebSocket with polling
- replace STOMP with another protocol
- introduce Redux/Zustand unnecessarily
- rewrite existing modules

---

# 5. Friend API Layer

Create/extend the centralized Friend API.

Conceptually:

```text
friendsApi.getFriends()
friendsApi.getIncomingRequests()
friendsApi.getOutgoingRequests()
friendsApi.sendRequest(...)
friendsApi.acceptRequest(...)
friendsApi.rejectRequest(...)
friendsApi.cancelRequest(...)
```

These names are examples only.

Use actual backend endpoints.

All requests must go through the centralized API client.

---

# 6. Friends Route

Add:

```text
/app/friends
```

to the authenticated Web application.

Navigation should include:

```text
Home
Search
Nearby
Friends
```

Chat can be represented through the Friends flow or a separate route depending on the existing router architecture.

---

# 7. Friends Page

Create a simple Friends page.

Recommended structure:

```text
Friends

Your Friends
----------------
Alice
Bob
Charlie


Incoming Requests
----------------
David       [Accept] [Reject]


Outgoing Requests
----------------
Eva         [Cancel]
```

The exact UI is flexible.

Keep it consistent with the existing Web design.

---

# 8. Friend List

Display:

- username
- display name
- avatar if already supported

Do not display private information.

Each friend should provide a way to open a Direct Chat.

Example:

```text
Alice
[Chat]
```

The Chat action must use the existing backend Direct Chat contract.

Do not create a new chat backend flow.

---

# 9. Incoming Requests

For each incoming request:

```text
[Accept] [Reject]
```

After successful Accept:

- remove request
- update Friends list
- user becomes a friend

After successful Reject:

- remove request
- user does not become a friend

Do not reload the entire browser.

---

# 10. Outgoing Requests

For each outgoing request:

```text
[Cancel]
```

After successful cancellation:

- remove request
- update Search relationship state if visible

---

# 11. User Search Integration

Extend the existing Search page.

Use the actual backend relationship information.

Possible states:

```text
SELF
NONE
FRIEND
INCOMING_PENDING
OUTGOING_PENDING
```

Use actual backend-supported values.

Example:

```text
No relationship
[Add Friend]

Outgoing request
[Cancel]

Incoming request
[Accept] [Reject]

Already friends
[Chat]
```

Do not invent relationship states.

---

# 12. Avoid N+1 Requests

Do NOT do:

```text
Search users
 ↓
for every user
 ↓
GET friendship status
```

Prefer:

1. relationship information from existing Search API
2. existing batch/relationship API
3. smallest backend enhancement if genuinely necessary

If a backend enhancement is required:

- preserve backward compatibility
- keep the change minimal
- explain it in the final report

---

# 13. Direct Chat Route

Implement a route for Direct Chat.

Possible conceptual route:

```text
/app/chat/:conversationId
```

Use the actual router conventions.

Do not create a route that exposes unauthorized conversations.

The backend remains responsible for conversation authorization.

---

# 14. Open Chat from Friend

When the user clicks Chat on a friend:

```text
Friend
 ↓
open/create direct conversation
 ↓
conversationId
 ↓
Chat screen
```

Use the existing backend endpoint.

The backend already guarantees one Direct Conversation per friend pair.

Do not create duplicate conversations from the Web application.

---

# 15. Conversation List

Implement a basic conversation list.

Possible route:

```text
/app/chat
```

Display:

- other participant
- last message
- last updated time if provided
- conversation selection

Keep it simple.

Do not implement:

- group conversations
- unread notification badges
- message reactions
- typing indicators

Those belong to later milestones.

---

# 16. Message History

When a conversation is opened:

Load existing messages from the backend.

Requirements:

- newest messages visible
- reasonable loading state
- empty conversation state
- error state
- pagination/load-more if supported by backend

If backend pagination is cursor/page based, follow the actual API contract.

Do not fetch the entire message history if the backend supports pagination.

---

# 17. Chat UI

Create a simple chat layout:

```text
┌─────────────────────────────────┐
│ Alice                           │
├─────────────────────────────────┤
│                                 │
│          Hi!                    │
│                                 │
│ Hello!                          │
│                                 │
├─────────────────────────────────┤
│ Message...              [Send]  │
└─────────────────────────────────┘
```

Requirements:

- clear sender/receiver distinction
- message timestamp if available
- scrollable message area
- input field
- send button
- Enter-to-send if appropriate

Do not over-design the chat UI.

---

# 18. Send Message

Use the existing REST message API for sending.

Conceptually:

```text
POST /api/v1/chats/{conversationId}/messages
```

Use the actual backend endpoint.

Flow:

```text
User types
 ↓
Send
 ↓
REST API
 ↓
message persisted
 ↓
WebSocket broadcast
```

Do not bypass the backend persistence layer.

---

# 19. WebSocket Connection

Connect to the existing backend WebSocket/STOMP endpoint.

Inspect the actual backend configuration first.

Use the existing JWT authentication mechanism.

The WebSocket client must:

1. connect after authentication
2. authenticate using the existing JWT mechanism
3. subscribe only to authorized conversation destinations
4. receive incoming messages
5. update the active conversation
6. clean up subscriptions when leaving

Do not connect WebSocket before authentication is ready.

---

# 20. WebSocket JWT Authentication

Follow the existing backend WebSocket authentication contract.

Do NOT:

- send JWT in arbitrary message bodies
- expose JWT in UI
- hardcode JWT
- create a second authentication system

If the backend expects JWT during STOMP CONNECT, implement that exact protocol.

---

# 21. Conversation Subscription

Subscribe only to the currently relevant conversation(s).

Example conceptual destination:

```text
/topic/chat/{conversationId}
```

Use the actual backend destination.

Do not subscribe to arbitrary conversation IDs without backend authorization.

The server remains responsible for authorization.

---

# 22. Realtime Message Handling

When a WebSocket message arrives:

1. parse payload
2. validate expected structure
3. convert to typed Message
4. append to the correct conversation
5. scroll appropriately

If the user is currently viewing another conversation:

- do not inject the message into the wrong chat
- update the appropriate conversation state if useful

Do not create notification functionality in this milestone.

---

# 23. Duplicate Message Prevention

Important:

The REST message creation may be followed by the same message arriving through WebSocket.

Do NOT show duplicates.

Use a stable message identifier from the backend.

Conceptually:

```text
existing message ID
+
incoming message ID
```

If already present:

```text
ignore duplicate
```

Do not use message text alone to determine duplicates.

---

# 24. WebSocket Reconnection

Handle temporary connection loss.

At minimum:

- detect disconnected state
- attempt reconnect when appropriate
- restore relevant subscription
- avoid creating duplicate subscriptions

Do not implement an unnecessarily complex reconnect framework.

Use the capabilities of the existing STOMP client if available.

---

# 25. Sending While WebSocket Is Offline

REST message sending should remain independent of WebSocket connectivity.

If:

```text
WebSocket disconnected
```

the user may still send through REST if the backend is available.

After REST succeeds:

- display the persisted message
- when WebSocket reconnects, deduplicate any repeated broadcast

Do not block message sending solely because WebSocket is disconnected.

---

# 26. Scroll Behavior

Implement sensible chat scrolling.

When opening a conversation:

- show the latest messages

When receiving a new message while near the bottom:

- scroll to the new message

When the user is reading older messages:

- do not forcibly jump to the bottom

Keep behavior simple.

---

# 27. Loading / Empty / Error States

Friends:

- loading
- empty
- error

Requests:

- loading
- empty
- error

Conversation list:

- loading
- empty
- error

Chat:

- loading history
- empty conversation
- sending
- send failure
- WebSocket disconnected/reconnecting

Do not display raw backend errors.

---

# 28. Authentication & Logout

Use the existing AuthProvider.

On logout:

1. disconnect WebSocket
2. remove subscriptions
3. clear authentication
4. navigate to Login

If WebSocket cleanup fails:

- logout must still succeed

Do not leave a live authenticated WebSocket connection after logout.

---

# 29. Security

Verify:

- authenticated API calls use JWT
- WebSocket uses the existing JWT authentication
- users cannot open arbitrary conversation IDs through the UI
- private conversation data is not exposed
- JWT is never displayed
- message content is rendered safely
- no raw HTML injection is introduced

Backend authorization remains the final security boundary.

---

# 30. TypeScript Models

Create/reuse typed models based on actual backend DTOs.

At minimum:

```text
Friend
FriendRequest
Conversation
ConversationParticipant
Message
MessagePage
```

Adapt to the actual backend response.

Do not invent properties.

Avoid `any`.

---

# 31. State Management

Keep state management simple.

Possible separation:

```text
Auth state
Friend state
Conversation state
Active chat state
WebSocket connection state
```

Do not introduce a global state library unless the existing application already uses one.

Avoid putting all chat state into a single giant component.

---

# 32. Tests

Inspect the existing Web test setup.

Add tests for:

## Friends

- friend list loads
- incoming requests
- outgoing requests
- send request
- accept
- reject
- cancel
- relationship state

## Chat

- conversation list
- open conversation
- message history
- send message
- message rendering
- empty state
- error state

## WebSocket

Test the message-handling logic where practical:

- incoming message added
- duplicate message ignored
- wrong conversation ignored
- reconnect state handled

Do not make tests depend on a real production WebSocket server if the existing test architecture does not support it.

Mock the transport where appropriate.

---

# 33. Validation

Run the existing commands.

At minimum:

```bash
cd web
npm run build
```

Also run available:

```bash
npm run test
npm run lint
npm run typecheck
```

Only run commands that actually exist.

Fix all errors introduced by this milestone.

---

# 34. Manual Verification

Use at least two test accounts.

## Scenario A — Friend request

```text
User A
 ↓
Search User B
 ↓
Add Friend
```

Verify User B sees the incoming request.

## Scenario B — Accept

```text
User B
 ↓
Friends
 ↓
Accept
```

Verify both users become friends.

## Scenario C — Open Chat

```text
User A
 ↓
Friends
 ↓
Chat User B
```

Verify the Direct Conversation opens.

## Scenario D — Send Message

```text
User A
 ↓
type "Hello"
 ↓
Send
```

Verify:

- message is persisted
- message appears in A's UI

## Scenario E — Realtime

With User B open in the same conversation:

```text
A sends message
 ↓
B receives message without refresh
```

Verify the message appears exactly once.

## Scenario F — History

Reload Chat.

Verify previous messages are loaded from the backend.

## Scenario G — Reconnect

Temporarily disconnect the network.

Verify:

- WebSocket shows disconnected/reconnecting state
- application does not crash
- REST behavior remains reasonable
- WebSocket reconnects when network returns

## Scenario H — Logout

Logout while Chat is open.

Verify:

- WebSocket disconnects
- subscriptions are removed
- authentication is cleared
- Login page appears

---

# 35. Regression Check

Verify existing Web functionality:

- Login
- Register
- Auth restoration
- Home
- User Search
- Nearby Users

Verify Friend functionality:

- send request
- accept
- reject
- cancel
- friend list

Do not break mobile functionality.

Do not modify unrelated backend behavior.

---

# 36. Scope Protection

DO NOT implement:

- Web Notifications
- Web Push Notifications
- notification badges
- read receipts
- typing indicators
- message reactions
- message editing
- message deletion
- media/file upload
- image upload
- voice messages
- video calls
- group chat
- group management
- profile editing
- settings
- map
- background location
- social login
- OAuth
- password reset
- 2FA
- admin dashboard
- complex UI redesign
- new global state-management framework

These belong to later milestones.

---

# 37. Completion Criteria

PROMPT_020 is complete only when:

## Friends

- [ ] Friends route implemented
- [ ] Friend list works
- [ ] Incoming requests work
- [ ] Outgoing requests work
- [ ] Send request works from Search
- [ ] Accept works
- [ ] Reject works
- [ ] Cancel works
- [ ] Relationship states are correct
- [ ] No unnecessary N+1 requests

## Chat

- [ ] Conversation list works
- [ ] Direct conversation opens
- [ ] Message history loads
- [ ] Text message sending works
- [ ] WebSocket connects
- [ ] JWT authentication works
- [ ] Conversation subscription works
- [ ] Realtime messages work
- [ ] Duplicate messages are prevented
- [ ] Reconnection works
- [ ] WebSocket cleanup on logout works
- [ ] Responsive chat UI works

## Quality

- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] Error states implemented
- [ ] Tests added/updated
- [ ] TypeScript passes
- [ ] Web build passes
- [ ] Existing features still work
- [ ] Manual verification completed

---

# Final Report

Report:

```text
PROMPT_020 COMPLETE
```

only if all applicable completion criteria are satisfied.

Otherwise:

```text
PROMPT_020 NOT COMPLETE
```

Then report:

1. What was implemented
2. Files changed
3. Pages/routes added
4. Friend APIs integrated
5. Chat APIs integrated
6. WebSocket/STOMP configuration
7. Authentication approach
8. Any backend changes
9. Tests executed
10. Build/typecheck results
11. Manual verification
12. Known limitations
13. Remaining work

Do not silently expand the scope.