# PROMPT 009 — DIRECT CHAT FOUNDATION

## Context

Project: GeoChat

Architecture:
- Monorepo
- Backend: Spring Boot modular monolith
- Database: PostgreSQL + PostGIS
- Authentication: JWT
- Migration: Flyway
- Backend language: Java 21

Fixed versions:
- Java 21
- Spring Boot 4.1.0
- Maven Wrapper / Maven 3.9.9
- PostgreSQL
- PostGIS
- Flyway

Completed milestones:

- PROMPT_001 — Project Skeleton
- PROMPT_002 — Backend Build Foundation
- PROMPT_003 — PostgreSQL/Flyway Foundation
- PROMPT_004 — User + Authentication
- PROMPT_005 — Current Location
- PROMPT_006 — Nearby Search with PostGIS
- PROMPT_007 — Friend Foundation
- PROMPT_008 — User Discovery & Search

PROMPT_008 has been completed and verified.

---

# Goal

Implement the first version of DIRECT CHAT.

Authenticated users who are already friends should be able to:

1. Create/open a direct conversation with a friend.
2. Send text messages.
3. Retrieve conversation messages.
4. Retrieve their direct conversations.
5. Retrieve basic conversation information.

This milestone is BACKEND ONLY.

Use REST APIs.

DO NOT implement WebSocket/realtime yet.

---

# 1. Chat Module

Create or extend:

```text
com.geochat.chat
```

Suggested structure:

```text
chat
├── controller
├── service
├── repository
├── entity
├── dto
└── exception
```

Follow the existing project architecture.

Do not create a second authentication/user system.

Do not duplicate Friend business logic unnecessarily.

---

# 2. Scope

Implement only:

```text
Direct Conversation
Text Message
Conversation List
Message List
Send Message
```

Do NOT implement:

- Group chat
- WebSocket
- STOMP
- realtime messaging
- typing indicator
- online/offline status
- read receipts
- delivered status
- message reactions
- attachments
- images
- videos
- files
- voice messages
- audio/video calls
- message editing
- message deletion
- message search
- notification
- push notification
- Redis
- Kafka
- RabbitMQ

Keep this milestone small and understandable.

---

# 3. Database Design

Create Flyway migration(s).

Use two main tables:

```text
conversations
messages
```

---

# 4. Conversations Table

Suggested structure:

```text
conversations
--------------
id
type
created_at
updated_at
```

For this milestone:

```text
type = DIRECT
```

Use the existing UUID convention if the project already uses UUID IDs.

---

# 5. Conversation Participants

A direct conversation requires two users.

Prefer a separate table:

```text
conversation_participants
--------------------------
conversation_id
user_id
created_at
```

Use:

```text
PRIMARY KEY (conversation_id, user_id)
```

Add foreign keys:

```text
conversation_id -> conversations.id
user_id         -> users.id
```

Add an index on:

```text
user_id
```

---

# 6. Prevent Duplicate Direct Conversations

A pair of friends must have only ONE direct conversation.

Example:

```text
A <-> B
```

must not create:

```text
conversation 1: A,B
conversation 2: A,B
```

and:

```text
conversation 1: A,B
conversation 2: B,A
```

must represent the same conversation.

Do not rely only on application-level checking.

Use an appropriate database constraint/design to guarantee uniqueness where practical.

If PostgreSQL schema design requires a dedicated direct-conversation key, implement it cleanly.

Do not introduce unnecessary complexity.

---

# 7. Friendship Requirement

Only friends can start or use a direct conversation.

Before creating/opening a conversation:

```text
currentUser
    +
targetUser
```

must have:

```text
Friend relationship = ACCEPTED
```

Reuse the existing Friend module.

Do not duplicate the friendship algorithm in Chat.

---

# 8. Open Direct Conversation

Create an endpoint:

```http
POST /api/v1/chats/direct
```

Request:

```json
{
  "userId": "target-user-id"
}
```

Rules:

1. Authenticate current user from JWT.
2. Target user must exist.
3. Current user cannot chat with themselves.
4. Current user and target user must be friends.
5. If a direct conversation already exists, return the existing conversation.
6. Otherwise create a new direct conversation.
7. Conversation must contain exactly two participants.

Example response:

```json
{
  "conversationId": "xxx",
  "type": "DIRECT",
  "participant": {
    "userId": "yyy",
    "displayName": "User B"
  }
}
```

Do not return unnecessary private user information.

---

# 9. Conversation List

Create:

```http
GET /api/v1/chats
```

Return conversations belonging to the authenticated user.

Example:

```json
{
  "items": [
    {
      "conversationId": "xxx",
      "type": "DIRECT",
      "participant": {
        "userId": "yyy",
        "displayName": "User B"
      },
      "updatedAt": "..."
    }
  ]
}
```

For this milestone, ordering should be:

```text
updated_at DESC
```

If a conversation has no messages yet, use the conversation's `updated_at`.

Do not return conversations where the current user is not a participant.

---

# 10. Conversation Detail

Create:

```http
GET /api/v1/chats/{conversationId}
```

Rules:

- authenticated user required
- user must be a participant
- otherwise return an appropriate authorization/not-found response according to existing conventions

Response should contain:

```text
conversationId
type
participants
createdAt
updatedAt
```

Only expose public user information.

---

# 11. Messages Table

Suggested structure:

```text
messages
--------
id
conversation_id
sender_id
content
created_at
```

Foreign keys:

```text
conversation_id -> conversations.id
sender_id       -> users.id
```

Indexes:

```text
conversation_id
created_at
```

Prefer a composite index supporting:

```text
conversation_id + created_at
```

if appropriate.

---

# 12. Message Content

This milestone supports TEXT messages only.

Rules:

- content must not be null
- content must not be blank
- trim leading/trailing whitespace
- define a reasonable maximum length, for example 5000 characters
- follow existing validation conventions if the project already defines a message length limit

Do not store HTML as a special trusted format.

Treat message content as plain text.

Do not implement Markdown rendering in the backend.

---

# 13. Send Message

Create:

```http
POST /api/v1/chats/{conversationId}/messages
```

Request:

```json
{
  "content": "Hello!"
}
```

Rules:

1. Authenticate current user.
2. Conversation must exist.
3. Current user must be a participant.
4. Sender must always come from JWT.
5. Validate content.
6. Create message.
7. Update conversation `updated_at`.

Example response:

```json
{
  "messageId": "xxx",
  "conversationId": "yyy",
  "senderId": "zzz",
  "content": "Hello!",
  "createdAt": "..."
}
```

Never accept `senderId` from the request body.

---

# 14. Retrieve Messages

Create:

```http
GET /api/v1/chats/{conversationId}/messages
```

Return messages belonging to the conversation.

Example:

```json
{
  "items": [
    {
      "messageId": "xxx",
      "senderId": "yyy",
      "content": "Hello!",
      "createdAt": "..."
    }
  ]
}
```

Only conversation participants can retrieve messages.

Do not expose messages from another conversation.

---

# 15. Pagination

Messages can grow indefinitely.

Do NOT load the entire conversation history.

Implement simple pagination.

Prefer:

```text
limit
before
```

or another simple cursor-based approach if it fits the current architecture.

Example:

```http
GET /api/v1/chats/{conversationId}/messages?limit=50
```

For an initial implementation, offset pagination is acceptable if the project has already standardized on it.

However, avoid designing the API in a way that assumes all messages can always be loaded at once.

Default:

```text
limit = 50
```

Maximum:

```text
limit = 100
```

Use the project's existing pagination conventions if available.

---

# 16. Message Ordering

API should return messages in a deterministic order.

Prefer chronological order for the response:

```text
created_at ASC
id ASC
```

when displaying a page of messages.

If pagination is implemented using a cursor, make sure the cursor semantics are documented clearly.

Do not rely only on timestamps if timestamps can be equal.

---

# 17. Conversation Updated Time

When a new message is created:

```text
conversations.updated_at
```

must be updated.

This allows:

```http
GET /api/v1/chats
```

to order conversations by most recently active.

Do not update `updated_at` merely because someone retrieves messages.

---

# 18. Authorization

Every Chat API must require authentication.

A user can only access conversations where they are a participant.

Examples:

```text
GET /api/v1/chats/{id}
GET /api/v1/chats/{id}/messages
POST /api/v1/chats/{id}/messages
```

must reject unauthorized access.

Do not rely only on frontend checks.

Authorization must be enforced server-side.

---

# 19. Security

Never trust these values from the client:

```text
senderId
currentUserId
participant ownership
```

Current user must come from JWT.

Do not expose:

- password
- password hash
- JWT
- refresh token
- internal security fields
- exact location
- unnecessary private profile information

Do not log message content unnecessarily.

Do not log authorization headers or tokens.

---

# 20. Database Integrity

Use database constraints where appropriate.

At minimum:

- foreign keys
- NOT NULL constraints
- primary keys
- participant uniqueness
- appropriate indexes

Do not rely exclusively on Java validation for relational integrity.

---

# 21. Transaction Handling

Conversation creation should be transactional.

For example:

```text
create conversation
+
create 2 participants
```

must succeed or fail as one unit.

Sending a message should also correctly update:

```text
message
+
conversation.updated_at
```

as one logical operation.

Use Spring transaction management according to the project's existing conventions.

Do not introduce distributed transactions.

---

# 22. Race Condition

Pay special attention to:

```text
A opens chat with B
A opens chat with B
```

at nearly the same time.

The database should prevent two direct conversations from being created.

If a race occurs:

- one conversation should remain
- the other request should safely resolve to the existing conversation or handle the conflict according to the chosen database design

Do not solve this with arbitrary sleeps/retries.

---

# 23. Tests

Add automated tests.

## Direct conversation

Test:

- authenticated user can open chat with friend
- existing conversation is returned
- duplicate conversation is not created
- non-friend cannot create chat
- target user does not exist
- self-chat rejected
- unauthenticated request rejected

## Conversation authorization

Test:

- participant can access conversation
- non-participant cannot access conversation
- participant can retrieve messages
- non-participant cannot retrieve messages
- participant can send message
- non-participant cannot send message

## Messages

Test:

- valid message sent
- blank content rejected
- whitespace-only content rejected
- content exceeding maximum length rejected
- sender comes from JWT
- conversation updated_at changes after message

## Conversation list

Test:

- only current user's conversations returned
- conversations ordered by updated_at DESC
- unrelated conversations are not returned

## Message list

Test:

- messages belong to correct conversation
- ordering is deterministic
- pagination/limit works

## Security

Explicitly verify:

```text
User A cannot:
- read User B's conversation
- send into User B's conversation
- retrieve User B's messages
```

---

# 24. Integration Tests

Prefer PostgreSQL integration tests for:

- conversation uniqueness
- participant constraints
- message persistence
- foreign keys
- ordering
- pagination

Do not mock away the database behavior that is important to the feature.

---

# 25. API Documentation

If OpenAPI/Swagger already exists, document:

```text
POST /api/v1/chats/direct

GET  /api/v1/chats

GET  /api/v1/chats/{conversationId}

GET  /api/v1/chats/{conversationId}/messages

POST /api/v1/chats/{conversationId}/messages
```

Document request/response DTOs and authorization requirements.

---

# 26. No WebSocket Yet

IMPORTANT:

Do NOT implement:

```text
WebSocket
STOMP
SSE
Realtime
```

Messages are sent and retrieved using REST only.

Realtime messaging will be a separate future milestone.

---

# 27. No Notification Yet

Do not send notifications.

Do not create notification infrastructure.

The Chat module should simply persist and return messages.

Notification will be handled in a future milestone.

---

# 28. Scope Protection

DO NOT implement:

- Group Chat
- Group
- Notification
- WebSocket
- realtime
- typing indicator
- read receipt
- delivered status
- online status
- message reaction
- message edit
- message delete
- attachment
- image
- file
- voice
- video call
- message search
- encryption/E2E
- Redis
- Kafka
- RabbitMQ
- push notification

Keep the milestone focused on:

```text
Direct Conversation + Text Messages + REST
```

---

# 29. Validation

Run:

```powershell
cd "D:\project\GeoChat\backend"

.\mvnw.cmd -version

.\mvnw.cmd test

.\mvnw.cmd -DskipTests compile
```

All commands must succeed.

Verify Flyway migrations execute successfully.

---

# 30. Manual Verification

After automated tests pass:

1. Start PostgreSQL.
2. Start the backend.
3. Register User A.
4. Register User B.
5. Register User C.
6. Login as User A.
7. Make A and B friends using the Friend API.
8. Open a direct chat between A and B.
9. Verify the conversation is created.
10. Open the same chat again.
11. Verify the same conversation ID is returned.
12. Send a message from A to B.
13. Retrieve the conversation messages.
14. Login as B.
15. Retrieve the conversation.
16. Verify B can see the message.
17. Send a reply from B.
18. Login as C.
19. Verify C cannot access the A-B conversation.
20. Verify C cannot send a message to the A-B conversation.
21. Verify conversation list ordering after new messages.

---

# 31. Final Report

At the end, report:

## Changed

List files/modules created or modified.

## Database

Explain:

- conversations
- conversation_participants
- messages
- constraints
- indexes
- uniqueness strategy for direct conversations

## APIs

List all implemented endpoints.

## Authorization

Explain how participant access is enforced.

## Pagination

Explain message pagination strategy.

## Tests

Report:

```text
Tests:
PASS / FAIL
```

Include exact Maven commands.

## Manual Verification

Report which flows were manually tested.

## Issues

List remaining issues or assumptions.

## Completion Status

Only report:

```text
PROMPT_009 COMPLETE
```

if ALL requirements above are implemented and verified.

Otherwise report:

```text
PROMPT_009 NOT COMPLETE
```

and clearly list what remains.

Do not modify unrelated modules or upgrade/downgrade project versions.