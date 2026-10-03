# PROMPT 015 — Mobile Direct Chat UI & Realtime Messaging

## Context

GeoChat is a beginner-friendly but technically grounded mobile + web application.

Previous milestones are complete:

- PROMPT 001 — Project Skeleton
- PROMPT 002 — Backend Build Foundation
- PROMPT 003 — PostgreSQL/Flyway Foundation
- PROMPT 004 — User + Authentication
- PROMPT 005 — Current Location
- PROMPT 006 — Nearby Users
- PROMPT 007 — Friend Foundation
- PROMPT 008 — User Discovery & Search
- PROMPT 009 — Direct Chat Backend
- PROMPT 010 — Chat WebSocket Backend
- PROMPT 011 — Notification Backend
- PROMPT 012 — Mobile Authentication/Foundation
- PROMPT 013 — Mobile Home/Search/Nearby Users
- PROMPT 014 — Mobile Friend UI

The existing backend already supports:

- Direct conversations
- Conversation participants
- Messages
- Message pagination
- Participant authorization
- Creating/opening a direct conversation
- WebSocket/STOMP realtime messaging
- JWT authentication for WebSocket
- Persist-before-broadcast behavior

Do NOT rebuild the backend Chat module.

---

# Goal

Implement Direct Chat on mobile.

The mobile user should be able to:

1. Open a Conversations screen.
2. See their direct conversations.
3. Open a conversation.
4. Load message history.
5. Send text messages.
6. Receive new messages in realtime through WebSocket.
7. Display sent/received messages correctly.
8. Handle loading, empty, error, and connection states.
9. Open a direct chat from a Friend.
10. Prevent unauthorized access to conversations.

This milestone is for **1-to-1 direct text chat only**.

---

# IMPORTANT — Inspect Before Coding

Before modifying code:

1. Inspect the current mobile architecture.
2. Inspect the API client created in PROMPT 012/013/014.
3. Inspect the current navigation.
4. Inspect the actual backend Chat REST APIs.
5. Inspect the actual backend WebSocket/STOMP configuration.
6. Inspect the actual JWT authentication mechanism for WebSocket.
7. Inspect backend DTOs and response fields.
8. Inspect how conversations and messages are represented.

Do NOT assume endpoint names, DTO fields, STOMP destinations, or authentication headers.

Use the existing backend implementation as the source of truth.

---

# Fixed Technology Constraints

Keep the existing mobile stack.

Expected:

- React Native
- Expo
- TypeScript

Do NOT migrate frameworks.

Do NOT introduce a new state-management framework.

Do NOT introduce a different WebSocket architecture if the project already has an appropriate abstraction.

Keep the implementation simple.

---

# 1. Conversations Screen

Create:

```text
ConversationsScreen
```

The screen should display the authenticated user's direct conversations.

Use the existing backend endpoint from PROMPT 009.

Conceptually:

```text
Messages

Alice
Last message preview
2 min ago

Bob
Last message preview
Yesterday
```

Use the actual backend response fields.

Do not invent fields that do not exist.

---

# 2. Conversation List Requirements

Each conversation item should provide enough information to identify the other participant.

For a direct conversation, display:

- other user's display name if available
- username if available
- last message preview if available
- timestamp if available

Do NOT display:

- raw database IDs unless necessary
- JWT
- private user information
- raw location
- internal backend fields

If the backend does not provide a last-message preview, do not create an additional endpoint just for this milestone unless clearly necessary.

Keep the UI simple.

---

# 3. Open Conversation

When the user taps a conversation:

Navigate to:

```text
ChatScreen
```

Pass only the minimum identifier needed by the existing navigation/API architecture.

Do not pass entire message histories through navigation parameters.

The ChatScreen should load messages from the backend.

---

# 4. Direct Chat Creation From Friend

The user should be able to start a direct chat with an existing friend.

Integrate this from the Friend UI.

For example:

```text
Friends

Alice
[ Message ]
```

When the user selects Message:

1. Call the existing direct-conversation API.
2. Backend determines whether a conversation already exists.
3. Open the resulting conversation.
4. Navigate to ChatScreen.

Do NOT create duplicate conversations on the client.

Do NOT implement chat creation by directly inserting local conversation objects.

Use the backend as the source of truth.

---

# 5. Direct Chat Authorization

Only users who are allowed by the backend should be able to access a direct conversation.

The mobile client must:

- use the authenticated API client
- not trust a conversation ID from navigation as proof of authorization
- handle `401`/`403` responses
- show an appropriate error state

Do not implement authorization logic separately from the backend.

---

# 6. Message History

ChatScreen must load existing messages from the backend.

Use the actual endpoint and pagination contract from PROMPT 009.

Conceptually:

```text
GET /api/v1/chats/{conversationId}/messages
```

Do NOT assume the exact pagination parameter names.

Inspect the backend.

---

# 7. Message UI

Create a simple chat interface.

Conceptually:

```text
Alice

                 Hi!
          10:30

Hello!
10:31

                 How are you?
          10:32


[ Type a message...        ] [Send]
```

Outgoing messages should be visually distinguishable from incoming messages.

Do not over-design the chat UI.

---

# 8. Text Messages Only

This milestone supports:

- plain text messages

Do NOT implement:

- images
- videos
- files
- audio
- voice messages
- stickers
- GIFs
- reactions
- replies
- forwarding
- editing
- deletion
- read receipts

Those are future features.

---

# 9. Sending a Message

Use the existing REST API for sending a message.

Conceptually:

```text
POST /api/v1/chats/{conversationId}/messages
```

Use the actual request DTO.

Flow:

1. User enters text.
2. Trim whitespace.
3. Reject empty message.
4. User presses Send.
5. Call REST API.
6. Backend persists the message.
7. Display the resulting message.
8. Clear the input after successful send.

Do not create a fake local message before the backend confirms success unless the existing architecture explicitly supports optimistic messaging.

For this milestone, prefer server-confirmed messages.

---

# 10. Prevent Duplicate Sends

While a message send request is in progress:

- prevent accidental duplicate submissions
- keep the UI responsive
- show a small sending state if appropriate

Do not send the same message multiple times because the user taps Send repeatedly.

---

# 11. Message Validation

At minimum:

- trim leading/trailing whitespace
- reject empty messages
- follow backend maximum message length
- display a friendly validation error

Do not duplicate complex backend validation rules.

If the backend exposes a maximum length, use the same value on the client where practical.

---

# 12. WebSocket / STOMP Realtime

Integrate the existing WebSocket implementation from PROMPT 010.

Before coding:

Inspect:

- WebSocket endpoint
- STOMP endpoint
- application destination
- subscription destination
- send destination
- JWT authentication mechanism
- connection requirements

Do NOT invent destinations.

Use the exact backend configuration.

---

# 13. WebSocket Authentication

The WebSocket connection must authenticate using the existing JWT mechanism.

Reuse the authenticated token already managed by the mobile app.

Do NOT create another login flow for WebSocket.

Do NOT store another copy of the JWT.

Do NOT log the JWT.

If the existing backend expects authentication during STOMP CONNECT, implement that exact contract.

---

# 14. WebSocket Lifecycle

The ChatScreen should manage the WebSocket subscription lifecycle correctly.

When entering a ChatScreen:

1. Establish/reuse the authenticated WebSocket connection.
2. Subscribe to the conversation destination.
3. Receive realtime messages.
4. Update the message list.

When leaving the ChatScreen:

- unsubscribe from the conversation
- clean up listeners/subscriptions
- avoid memory leaks

Do not create a new uncontrolled WebSocket connection every time the component renders.

---

# 15. Realtime Message Handling

When a new message arrives through WebSocket:

1. Verify it belongs to the currently open conversation.
2. Add it to the message list.
3. Avoid duplicate messages.
4. Keep the existing scroll behavior reasonable.

Do not blindly append every incoming WebSocket event.

Use the message's actual backend identifier to prevent duplicates where available.

---

# 16. REST + WebSocket Interaction

Important:

REST is responsible for:

- loading history
- sending messages

WebSocket is responsible for:

- realtime delivery

Do NOT make WebSocket the only source of truth.

A message should be persisted by the backend before it is considered successfully sent.

Reuse the backend behavior implemented in PROMPT 010.

---

# 17. Realtime Message Sent By Current User

Be careful with the following scenario:

1. User A sends message through REST.
2. REST returns the created message.
3. WebSocket broadcasts the same message.
4. Mobile receives the same message again.

The UI must not show the same message twice.

Use the backend message ID or equivalent unique identifier to deduplicate messages.

Do not rely only on message text/timestamp for deduplication.

---

# 18. Conversation List Updates

When a new message arrives:

- update the relevant conversation preview if the backend data supports it
- otherwise refresh the conversation list when appropriate

Do not implement a complex global realtime messaging store unless the existing architecture already has one.

Keep the implementation maintainable.

---

# 19. Pagination

Use backend pagination for message history.

At minimum:

- load the first page
- support loading older messages when appropriate

For a chat UI, prefer loading older messages when the user scrolls toward the top.

Do not load the entire message history at once.

Use the backend's actual pagination model.

If implementing infinite scroll would require excessive architecture changes, implement a simple "Load older messages" action while preserving the backend pagination.

---

# 20. Scroll Behavior

Implement basic chat-friendly scrolling.

After loading the initial conversation:

- show the newest messages.

When a new message arrives while the user is near the bottom:

- keep the user near the latest message.

If the user has scrolled significantly upward:

- do not aggressively force them back to the bottom.

Keep this behavior simple.

Do not implement advanced chat scrolling libraries unless already present.

---

# 21. Empty Conversation

If a conversation has no messages:

Show something like:

```text
No messages yet.
Start the conversation!
```

Then display the message input.

Do not treat this as an error.

---

# 22. Loading and Error States

ChatScreen should handle:

### Loading history

```text
Loading messages...
```

### Sending

Show a small sending state.

### WebSocket connecting

Show a subtle connection state if appropriate.

### WebSocket disconnected

Show:

```text
Reconnecting...
```

or an equivalent non-blocking status.

### API failure

Allow retry.

### Unauthorized

Use existing auth/session handling.

### Forbidden

Show an appropriate access message.

Do not expose raw server errors.

---

# 23. WebSocket Reconnection

Implement basic reconnection handling if supported by the WebSocket library already used by the project.

Requirements:

- do not create infinite uncontrolled reconnect loops
- clean up reconnect attempts when leaving the screen
- avoid duplicate subscriptions
- re-subscribe after a successful reconnect

Keep the reconnection strategy simple.

Do not implement a complicated networking framework.

---

# 24. Connection Architecture

Prefer a reusable WebSocket service rather than putting all STOMP logic directly inside ChatScreen.

For example:

```text
services/
  websocket/
    chatWebSocketService.ts
```

or adapt to the existing project architecture.

The service should handle:

- connect
- disconnect
- subscribe
- unsubscribe
- send if needed
- connection state

ChatScreen should focus primarily on UI/state.

Do not duplicate WebSocket setup across multiple components.

---

# 25. API Layer

Reuse/create typed Chat API methods.

Conceptually:

```text
chatApi.ts
```

Possible methods:

```text
getConversations(...)
createDirectConversation(...)
getMessages(...)
sendMessage(...)
```

Use the actual backend API contract.

Do not call REST endpoints directly from UI components.

---

# 26. TypeScript Types

Create/reuse types for:

- Conversation
- Conversation participant
- Message
- Message pagination response
- Direct conversation request/response
- Send message request/response
- WebSocket message payload

Do not use `any`.

Keep API models centralized.

---

# 27. Friend → Chat Integration

Update the Friend UI from PROMPT 014.

For an existing friend, provide a way to start a conversation.

Conceptually:

```text
Alice

[ Message ]
```

The action should:

1. Create/open the direct conversation through the backend.
2. Navigate to ChatScreen.
3. Load message history.

Do not duplicate conversation-creation logic inside FriendsScreen.

Put the logic in the Chat API/service layer.

---

# 28. Conversations Entry Point

Add an authenticated entry point to Conversations.

For example:

```text
Home
├── Search Users
├── Nearby Users
├── Friends
└── Messages
```

Use the existing navigation architecture.

Do not replace the navigation library.

---

# 29. Tests

Use the existing mobile testing setup.

Add focused tests.

## Conversations

- conversations load successfully
- conversations render
- empty state works
- API error works

## Direct conversation

- opening a conversation loads messages
- unauthorized/forbidden state is handled

## Sending messages

- empty message is rejected
- valid message calls API
- duplicate sends are prevented
- successful message appears
- API failure is handled

## WebSocket

Test important service behavior where practical:

- connection
- subscription
- message handling
- duplicate message prevention
- cleanup/unsubscribe

If full WebSocket integration testing is not practical in the current mobile test environment, create focused service-level tests and document the limitation.

## Friend integration

- Message action opens/creates a direct conversation
- navigation to ChatScreen works

---

# 30. Manual Verification

Use at least two test accounts:

```text
Account A
Account B
```

Both should already be friends.

### Conversation creation

1. Login as A.
2. Open Friends.
3. Select B.
4. Press Message.
5. Confirm ChatScreen opens.
6. Confirm conversation is created/reused.

### Send message

1. A sends:
   `Hello B`
2. Confirm REST request succeeds.
3. Confirm message appears once.

### Realtime receive

1. Keep A's chat open.
2. Login as B on another device/emulator/browser if available.
3. Open the same conversation.
4. B sends:
   `Hello A`
5. Confirm A receives it through WebSocket without manually refreshing.

### Duplicate protection

Confirm a sent message does not appear twice because of REST + WebSocket delivery.

### History

1. Close ChatScreen.
2. Reopen it.
3. Confirm previous messages load from backend.

### Pagination

If enough messages exist:

1. Scroll upward.
2. Load older messages.
3. Confirm messages are not duplicated.

### Connection failure

If practical:

1. Disable network.
2. Observe connection/error state.
3. Restore network.
4. Confirm the app recovers appropriately.

---

# 31. Security / Privacy

Do not log:

- JWT
- authorization headers
- private message contents unnecessarily
- WebSocket credentials

Do not store chat messages in insecure global storage.

Do not expose conversation data to unauthenticated screens.

Do not trust client-side conversation IDs as authorization.

Backend authorization remains the source of truth.

---

# 32. Scope Protection

DO NOT implement:

- group chat
- group conversations
- image messages
- video messages
- file upload
- audio messages
- voice calls
- video calls
- message reactions
- message replies
- message editing
- message deletion
- read receipts
- typing indicators
- online/offline presence
- push notifications
- notification center
- message search
- encryption layer
- end-to-end encryption

These belong to later milestones.

---

# 33. Regression Protection

Do not break:

- Register
- Login
- Logout
- Home
- User Search
- Nearby Users
- Friends
- Friend Requests
- Current Location
- existing backend Chat APIs
- existing WebSocket backend behavior

Run existing tests.

Do not rewrite working Friend or Auth code unnecessarily.

---

# 34. Validation

Run the appropriate mobile validation.

At minimum:

```bash
cd apps/mobile
npx tsc --noEmit
```

Run the existing mobile tests.

Run the existing build/check command.

If backend code was modified:

```bash
cd backend
.\mvnw.cmd test
```

Only report commands that were actually executed.

Do not mark the milestone complete if required validation fails.

---

# 35. Final Report

When finished, report:

## Changed

List:

- Conversations screen
- Chat screen
- message history
- send message
- WebSocket integration
- realtime message handling
- duplicate message prevention
- pagination
- Friend → Message integration
- navigation
- API services
- TypeScript types
- tests

## Backend Changes

Explicitly state:

```text
Backend changed: YES/NO
```

If YES:

- explain why
- list files changed
- list tests changed

Prefer:

```text
Backend changed: NO
```

because the backend Chat functionality should already exist.

## Validation

Report exact commands and results.

Example:

```text
npx tsc --noEmit    PASS
npm test            PASS
.\mvnw.cmd test     PASS
```

Only report commands actually executed.

## Manual Verification

Report:

- Account A → Account B messaging
- realtime receive
- message history
- duplicate prevention
- pagination
- reconnect/error behavior if tested

## Scope Check

Confirm that these were NOT implemented:

- Group chat
- Media messages
- Voice/video calls
- Reactions
- Typing indicators
- Read receipts
- Push notifications
- Notification center

---

# Completion Rule

Only report:

```text
PROMPT_015 COMPLETE
```

if:

- Conversations screen works
- Direct Chat works
- Message history works
- Sending text messages works
- WebSocket realtime receiving works
- REST + WebSocket duplicates are prevented
- Friend → Chat flow works
- authentication/security is preserved
- tests pass
- TypeScript validation passes
- regression checks pass

Otherwise report:

```text
PROMPT_015 NOT COMPLETE
```

and clearly list:

1. what is incomplete
2. what failed
3. what remains to be fixed

Do not mark the milestone complete just because the application compiles.

# End of PROMPT 015