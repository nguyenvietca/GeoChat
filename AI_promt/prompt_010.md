# PROMPT 010 — CHAT REALTIME WITH WEBSOCKET

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
- PROMPT_009 — Direct Chat Foundation

PROMPT_009 has been completed and verified.

The REST-based Direct Chat is already working.

---

# Goal

Add realtime messaging to the existing Direct Chat using WebSocket.

The goal is:

```text
User A sends message
        ↓
WebSocket
        ↓
Backend
        ↓
persist message
        ↓
deliver realtime event
        ↓
User B receives message
```

REST APIs from PROMPT_009 remain available and continue to work.

This milestone is BACKEND ONLY unless a minimal WebSocket test client is needed for manual verification.

---

# 1. Technology

Use Spring WebSocket with STOMP if compatible with the existing Spring Boot 4.1.0 setup.

Preferred architecture:

```text
WebSocket
+
STOMP
+
Spring messaging
```

Do NOT introduce:

- Socket.IO
- Netty custom protocol
- Redis Pub/Sub
- Kafka
- RabbitMQ
- external realtime service

Keep the architecture simple.

---

# 2. Dependencies

Add only the dependencies required for:

```text
Spring WebSocket
STOMP messaging
```

Use versions managed by Spring Boot 4.1.0 dependency management.

Do NOT manually override Spring Framework versions unless absolutely necessary.

Do not upgrade or downgrade Spring Boot.

---

# 3. WebSocket Endpoint

Create a WebSocket endpoint such as:

```text
/ws
```

If the project already has a standard API prefix/configuration convention, follow it.

The client should be able to establish a WebSocket connection.

Example conceptual flow:

```text
CONNECT /ws
```

then STOMP subscriptions.

Do not create multiple unnecessary WebSocket endpoints.

---

# 4. STOMP Configuration

Configure:

```text
application destination prefix
subscription destination prefix
```

A simple convention is:

```text
/app
/topic
```

For example:

```text
/app/chat/{conversationId}/send
```

and:

```text
/topic/chat/{conversationId}
```

Follow the project's existing conventions if any exist.

---

# 5. Authentication

IMPORTANT:

WebSocket connections must be authenticated.

Do NOT allow an unauthenticated user to connect and subscribe to arbitrary conversations.

The authenticated user must be derived from the JWT.

Do NOT trust:

```text
userId
senderId
```

from the STOMP message payload.

---

# 6. JWT Authentication During WebSocket Handshake

Reuse the existing JWT authentication infrastructure where practical.

The WebSocket connection should authenticate the user using the existing JWT mechanism.

If the browser/client cannot conveniently use the normal HTTP Authorization header during the WebSocket handshake, implement a clean STOMP CONNECT authentication mechanism using a token header.

For example:

```text
CONNECT
Authorization: Bearer <JWT>
```

Do NOT create a second authentication system.

Do NOT duplicate JWT parsing logic.

Reuse the existing JWT service/security components.

---

# 7. WebSocket Security

A connected user must only be able to:

1. Subscribe to conversations they belong to.
2. Send messages to conversations they belong to.

For example:

```text
User A
Conversation A-B
```

User A may:

```text
subscribe /topic/chat/{A-B}
send /app/chat/{A-B}/send
```

But User C must not be able to subscribe or send to:

```text
A-B
```

if C is not a participant.

Authorization must be checked server-side.

Do not rely on frontend/mobile checks.

---

# 8. Subscription

Use a destination such as:

```text
/topic/chat/{conversationId}
```

When a user subscribes:

1. Extract authenticated user.
2. Extract conversation ID.
3. Verify the user is a participant.
4. Allow subscription only if authorized.

If unauthorized:

```text
reject subscription
```

Do not expose conversation existence unnecessarily if the project's security conventions prefer a generic authorization response.

---

# 9. Send Message

Use:

```text
/app/chat/{conversationId}/send
```

Example STOMP payload:

```json
{
  "content": "Hello!"
}
```

Do NOT accept:

```text
senderId
userId
```

from the client.

Sender must come from authenticated WebSocket user.

---

# 10. Message Validation

Apply the same validation rules used by REST Chat.

At minimum:

- content required
- content cannot be blank
- trim whitespace
- maximum message length
- plain text only

Do not create different validation rules between REST and WebSocket.

Prefer reusing existing Chat service validation.

---

# 11. Message Persistence

IMPORTANT:

A WebSocket message must be persisted to PostgreSQL.

Do NOT simply broadcast an in-memory event.

Flow:

```text
STOMP SEND
   ↓
authenticate
   ↓
authorize conversation
   ↓
validate content
   ↓
save message
   ↓
update conversation.updated_at
   ↓
broadcast persisted message
```

The event sent to subscribers should represent the successfully persisted message.

---

# 12. Reuse Existing Chat Service

Do not duplicate message creation logic.

The REST endpoint from PROMPT_009 already knows how to create a message.

Refactor if necessary so both:

```text
REST
```

and:

```text
WebSocket
```

call the same application/service-layer logic.

Preferred architecture:

```text
REST Controller
       \
        → Chat Service → Repository
       /
WebSocket Controller
```

Do not implement separate persistence logic for WebSocket.

---

# 13. Broadcast Destination

After a message is successfully persisted:

```text
/topic/chat/{conversationId}
```

should receive the message event.

Example:

```json
{
  "messageId": "xxx",
  "conversationId": "yyy",
  "senderId": "zzz",
  "content": "Hello!",
  "createdAt": "..."
}
```

The event should use the persisted:

```text
messageId
createdAt
conversationId
senderId
```

Do not generate a second temporary message object that differs from the database record.

---

# 14. Sender Should Receive the Event Too

For this milestone, broadcast the message to all authorized subscribers of the conversation, including the sender if they are subscribed.

This keeps client state simple.

Do not implement special sender-only acknowledgement yet.

---

# 15. REST APIs Remain

Do NOT remove or replace the REST APIs from PROMPT_009.

They remain useful for:

```text
conversation creation
conversation list
conversation detail
message history
fallback
```

WebSocket is only for realtime delivery.

Architecture:

```text
REST
→ history / conversation management

WebSocket
→ realtime message delivery
```

---

# 16. Connection Lifecycle

Handle basic lifecycle correctly:

```text
CONNECT
DISCONNECT
```

Do not implement online presence yet.

Do not persist online/offline status.

Do not create presence tables.

The server may log basic connection lifecycle information if useful, but do not log JWTs or sensitive data.

---

# 17. Error Handling

Handle at minimum:

### Invalid JWT

Reject connection/authentication.

### Expired JWT

Reject authentication.

### Invalid subscription

Reject unauthorized conversation subscription.

### Unauthorized send

Reject message.

### Invalid message

Reject blank/oversized message.

### Conversation does not exist

Reject operation.

Use the project's existing error conventions where possible.

Do not expose stack traces to clients.

---

# 18. WebSocket Error Destination

If practical, provide a consistent user-specific error destination.

For example:

```text
/user/queue/errors
```

Example:

```json
{
  "code": "CHAT_ACCESS_DENIED",
  "message": "You cannot access this conversation."
}
```

Do not leak internal exception messages.

If the project's architecture already has a standard WebSocket error handling mechanism, reuse it.

---

# 19. Transaction Boundary

Message persistence and conversation timestamp update must happen transactionally.

Conceptually:

```text
save message
+
update conversation.updated_at
```

must be one logical transaction.

Only broadcast after successful persistence.

Do not broadcast a message that failed to save.

---

# 20. Concurrency

Multiple messages may arrive simultaneously.

Do not assume WebSocket messages are processed sequentially across all users.

Database persistence must remain correct under concurrent sends.

Message ordering should be deterministic using:

```text
created_at
+
message id
```

or the existing ordering strategy from PROMPT_009.

Do not implement distributed locking.

---

# 21. Security Requirements

Explicitly verify:

```text
User A:
  can subscribe A-B
  can send to A-B

User C:
  cannot subscribe A-B
  cannot send to A-B
```

Also verify:

```text
User C cannot spoof senderId = A
```

and:

```text
User C cannot spoof userId = A
```

The server must always derive identity from the authenticated WebSocket session.

---

# 22. Tests

Add automated tests.

## WebSocket connection

Test:

- valid JWT can connect
- missing JWT rejected
- invalid JWT rejected
- expired JWT rejected

## Subscription

Test:

- participant can subscribe
- non-participant cannot subscribe
- invalid conversation rejected

## Sending

Test:

- participant can send
- message is persisted
- conversation updated_at is updated
- realtime event is broadcast
- sender identity comes from JWT
- non-participant cannot send
- blank content rejected
- oversized content rejected

## Security

Test:

- senderId spoofing fails
- userId spoofing fails
- unauthorized conversation access fails

## REST compatibility

Existing Chat REST tests must continue passing.

Do not break PROMPT_009 functionality.

---

# 23. Integration Testing

Prefer real integration testing for WebSocket behavior if practical.

At minimum verify:

```text
connect
→ authenticate
→ subscribe
→ send
→ persist
→ receive event
```

Use PostgreSQL for persistence tests.

If full end-to-end WebSocket testing is difficult in the existing test infrastructure, implement the strongest practical integration coverage and clearly document the limitation.

Do not mark the milestone COMPLETE while silently skipping security tests.

---

# 24. Manual Verification

Perform an actual WebSocket test.

Use an appropriate STOMP/WebSocket test client.

Recommended test scenario:

### User A

1. Login.
2. Obtain JWT.
3. Connect to WebSocket.
4. Authenticate.
5. Subscribe:

```text
/topic/chat/{conversationId}
```

### User B

1. Login.
2. Obtain JWT.
3. Connect to WebSocket.
4. Authenticate.
5. Subscribe to the same conversation.

### Send

User A sends:

```json
{
  "content": "Hello from A"
}
```

Verify:

```text
Database:
message exists

User A:
receives message

User B:
receives message
```

Then repeat:

```text
B → A
```

Verify the same behavior.

---

# 25. Unauthorized Manual Test

Create:

```text
User C
```

where C is not a participant in A-B conversation.

Attempt:

```text
C → subscribe A-B
```

and:

```text
C → send A-B
```

Both must fail.

Also attempt to spoof:

```json
{
  "senderId": "user-A",
  "content": "Fake message"
}
```

The server must reject/ignore the spoofed identity and never persist the message as User A.

---

# 26. Performance

Do not introduce infrastructure prematurely.

For this milestone:

- no Redis
- no Kafka
- no RabbitMQ
- no message broker
- no horizontal WebSocket cluster
- no distributed session

Use the Spring application as the WebSocket server.

Document that this is appropriate for the current MVP/single-instance architecture.

---

# 27. Logging

Do not log:

```text
JWT
Authorization header
password
password hash
full sensitive user information
```

Avoid logging every message content.

If logging message operations, prefer:

```text
conversationId
messageId
authenticatedUserId
```

only when useful.

---

# 28. Scope Protection

DO NOT implement:

- typing indicator
- read receipt
- delivered status
- online/offline status
- presence
- last seen
- notification
- push notification
- group chat
- group WebSocket
- file upload
- image message
- voice message
- video call
- reactions
- message editing
- message deletion
- message search
- Redis
- Kafka
- RabbitMQ
- horizontal WebSocket clustering

Keep the milestone focused on:

```text
Authenticated Direct Chat Realtime Messaging
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

Verify existing Flyway migrations still work.

Verify all existing tests from previous milestones still pass.

---

# 30. Regression Verification

IMPORTANT:

PROMPT_010 must not break:

```text
Authentication
User Search
Friend
Location
Nearby Search
Direct Chat REST
```

Run the complete backend test suite.

Do not run only new WebSocket tests.

---

# 31. Final Report

At the end, report:

## Changed

List files/modules created or modified.

## WebSocket

Document:

```text
WebSocket endpoint:
STOMP destinations:
Authentication mechanism:
```

## Realtime Flow

Explain:

```text
CONNECT
→ AUTH
→ SUBSCRIBE
→ SEND
→ PERSIST
→ BROADCAST
```

## Security

Explain:

- JWT authentication
- participant authorization
- sender identity
- subscription authorization

## Persistence

Explain how WebSocket messages reuse the existing Chat service.

## Tests

Report:

```text
Tests:
PASS / FAIL
```

Include exact Maven commands.

## Manual Verification

Report:

```text
A → B:
PASS / FAIL

B → A:
PASS / FAIL

Unauthorized C:
PASS / FAIL

Spoofing:
PASS / FAIL
```

## Regression

Report whether all previous tests still pass.

## Issues

List remaining issues or limitations.

## Completion Status

Only report:

```text
PROMPT_010 COMPLETE
```

if ALL requirements above are implemented and verified.

Otherwise report:

```text
PROMPT_010 NOT COMPLETE
```

and clearly list what remains.

Do not modify unrelated modules or upgrade/downgrade project versions.