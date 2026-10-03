# PROMPT 07 — FRIEND FOUNDATION

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

Previous milestones:
- PROMPT_001 — Project Skeleton
- PROMPT_002 — Backend Build Foundation
- PROMPT_003 — PostgreSQL/Flyway foundation
- PROMPT_004 — User + Authentication
- PROMPT_005 — Current Location
- PROMPT_006 — Nearby Search with PostGIS

PROMPT_006 has been completed successfully.

---

# Goal

Implement the first version of the `friend` module.

Users should be able to:

1. Send a friend request to another user.
2. View their incoming/outgoing friend requests.
3. Accept a friend request.
4. Reject a friend request.
5. Cancel their own outgoing request.
6. View their current friends.

Keep this milestone backend-only.

DO NOT implement:
- Chat
- Group
- Notification
- WebSocket
- Realtime friend status
- Friend recommendation
- Nearby friend integration
- Blocking users
- Muting users
- Frontend/mobile UI

---

# 1. Friend Module

Create a modular package:

`com.geochat.friend`

Keep responsibilities separated:

```text
friend
├── controller
├── service
├── repository
├── entity
├── dto
└── exception
```

Follow the existing project conventions if the current codebase already has an established structure.

Do NOT introduce a completely different architecture.

---

# 2. Database Design

Create a Flyway migration for friend relationships.

Use a table similar to:

```text
friend_requests
```

Suggested columns:

```text
id
sender_id
receiver_id
status
created_at
updated_at
```

Use UUID if the existing user ID uses UUID.

Status should be explicit, for example:

```text
PENDING
ACCEPTED
REJECTED
CANCELLED
```

Use the existing project conventions if enum/status representation already exists.

Foreign keys:

```text
sender_id   -> users.id
receiver_id -> users.id
```

Add appropriate indexes.

At minimum, indexes should support:

```text
sender_id
receiver_id
status
```

Add constraints to prevent:

```text
sender_id = receiver_id
```

Do not allow a user to send a friend request to themselves.

---

# 3. Friend Request Rules

Implement these business rules.

## Send request

Authenticated user sends a request to another user.

Example:

```http
POST /api/v1/friends/requests
```

Request:

```json
{
  "userId": "target-user-id"
}
```

The sender must always come from JWT authentication.

NEVER trust a client-provided sender ID.

Validation:

- target user must exist
- sender cannot equal receiver
- cannot create duplicate pending request
- cannot create a new request if users are already friends
- handle an existing reverse pending request correctly

For the reverse-request case:

Example:

```text
A -> B PENDING
B -> A request
```

Do not blindly create another relationship.

Choose a clear deterministic behavior based on the existing API/error conventions.

Prefer returning a business validation error rather than creating duplicate relationships.

---

# 4. Accept Request

Example:

```http
POST /api/v1/friends/requests/{requestId}/accept
```

Only the receiver of the request can accept it.

Requirements:

- request must exist
- request must be PENDING
- authenticated user must be the receiver
- change status to ACCEPTED

Do not allow the sender to accept their own request.

---

# 5. Reject Request

Example:

```http
POST /api/v1/friends/requests/{requestId}/reject
```

Only the receiver can reject.

Requirements:

- request exists
- request is PENDING
- authenticated user is receiver
- change status to REJECTED

---

# 6. Cancel Request

Example:

```http
POST /api/v1/friends/requests/{requestId}/cancel
```

Only the sender can cancel.

Requirements:

- request exists
- request is PENDING
- authenticated user is sender
- change status to CANCELLED

Do not allow the receiver to cancel someone else's outgoing request.

---

# 7. Friend List

Add:

```http
GET /api/v1/friends
```

Return users who have an ACCEPTED friendship with the authenticated user.

Example:

```json
{
  "items": [
    {
      "userId": "xxx",
      "displayName": "User B"
    }
  ]
}
```

Do not return:

- password
- password hash
- JWT
- private authentication information
- unnecessary private user fields

Follow the existing User DTO conventions.

---

# 8. Incoming Requests

Add:

```http
GET /api/v1/friends/requests/incoming
```

Return pending requests where:

```text
receiver_id = currentUser
status = PENDING
```

Example:

```json
{
  "items": [
    {
      "requestId": "xxx",
      "user": {
        "userId": "xxx",
        "displayName": "User A"
      },
      "createdAt": "..."
    }
  ]
}
```

---

# 9. Outgoing Requests

Add:

```http
GET /api/v1/friends/requests/outgoing
```

Return pending requests where:

```text
sender_id = currentUser
status = PENDING
```

---

# 10. Authentication & Authorization

Every friend API must require authentication.

The current user must always be determined from the authenticated JWT.

Do NOT accept:

```text
senderId
currentUserId
ownerId
```

from the client for authorization decisions.

Authorization must be enforced in the service layer.

Examples:

```text
accept:
currentUser == receiver

reject:
currentUser == receiver

cancel:
currentUser == sender
```

A user must never be able to modify another user's request.

---

# 11. Friendship Representation

For this milestone, do NOT create a second friendship table unless the existing architecture strongly requires it.

An ACCEPTED `friend_requests` record can represent the friendship.

When checking whether two users are friends, treat:

```text
status = ACCEPTED
```

as the friendship relationship.

Make sure queries correctly handle both directions:

```text
A -> B ACCEPTED
```

and:

```text
B -> A ACCEPTED
```

represent the same friendship.

Do not create duplicate accepted relationships.

---

# 12. API Error Handling

Follow the existing project's error response format.

Do not introduce a completely new error format.

Handle at minimum:

- unauthenticated
- target user not found
- request not found
- invalid request state
- unauthorized request modification
- self-friend request
- duplicate pending request
- already friends

Use appropriate HTTP status codes according to the existing project conventions.

---

# 13. Concurrency / Data Integrity

Pay attention to race conditions.

Two simultaneous requests should not create duplicate pending friend requests.

Use database constraints where appropriate instead of relying only on Java checks.

If PostgreSQL-specific constraints/indexes are required, implement them in Flyway.

Do not add distributed locking, Redis, or complex infrastructure.

---

# 14. Repository / Query Design

Do not load all friend requests/users into Java and filter them there.

Filtering should happen in PostgreSQL.

Repository queries should support:

```text
incoming pending requests
outgoing pending requests
accepted friendships
request lookup
duplicate detection
```

Use parameterized queries.

Do not concatenate user input into SQL.

---

# 15. Tests

Add automated tests for the friend module.

At minimum cover:

### Send request

- authenticated user can send request
- unauthenticated user cannot
- target user does not exist
- self request rejected
- duplicate pending request rejected
- request between already-friends users rejected

### Accept

- receiver can accept
- sender cannot accept
- unrelated user cannot accept
- non-existing request
- already processed request

### Reject

- receiver can reject
- sender cannot reject
- unrelated user cannot reject
- non-existing request
- already processed request

### Cancel

- sender can cancel
- receiver cannot cancel
- unrelated user cannot cancel
- non-existing request
- already processed request

### Friend list

- accepted friend appears
- pending request does not appear
- rejected request does not appear
- cancelled request does not appear
- current user does not appear as their own friend

### Request lists

- incoming only returns pending incoming requests
- outgoing only returns pending outgoing requests
- unrelated requests are not exposed

### Security

Explicitly test that User A cannot manipulate User B's request.

Prefer integration tests with PostgreSQL if the existing project already uses PostgreSQL integration testing.

---

# 16. API Documentation

If the project already has OpenAPI/Swagger conventions, document the new endpoints consistently.

At minimum document:

```text
POST   /api/v1/friends/requests
GET    /api/v1/friends/requests/incoming
GET    /api/v1/friends/requests/outgoing
POST   /api/v1/friends/requests/{requestId}/accept
POST   /api/v1/friends/requests/{requestId}/reject
POST   /api/v1/friends/requests/{requestId}/cancel
GET    /api/v1/friends
```

---

# 17. Scope Protection

Do NOT implement:

- chat
- group
- notification
- WebSocket
- realtime presence
- friend recommendation
- nearby friends
- location sharing
- blocking
- mute
- report user
- search users
- pagination framework unless already established
- frontend/mobile UI

Keep the implementation focused on the basic friend-request lifecycle.

---

# 18. Validation

After implementation, run:

```powershell
cd "D:\project\GeoChat\backend"

.\mvnw.cmd -version

.\mvnw.cmd test

.\mvnw.cmd -DskipTests compile
```

All commands must succeed.

If PostgreSQL/PostGIS is required for tests, make sure the required database setup is available and Flyway migrations run successfully.

---

# 19. Manual Verification

After automated tests pass:

1. Start PostgreSQL.
2. Start the Spring Boot backend.
3. Register User A.
4. Register User B.
5. Login as User A.
6. Send friend request to User B.
7. Login as User B.
8. Check incoming requests.
9. Accept the request.
10. Check friend list.
11. Verify User A appears in User B's friend list.
12. Verify User B appears in User A's friend list.
13. Test rejection with another request.
14. Test cancellation with another request.
15. Test unauthorized modification using a third user.

Verify that sensitive user information is never returned.

---

# 20. Final Report

At the end, report:

## Changed
List files/modules created or modified.

## Database
Explain the Flyway migration and constraints/indexes.

## APIs
List all friend endpoints.

## Business Rules
Summarize request/accept/reject/cancel behavior.

## Security
Explain authentication and authorization checks.

## Tests
Report:

```text
Tests:
PASS / FAIL
```

Include the exact Maven command used.

## Manual Verification
Report which flows were manually tested.

## Issues
List any remaining issues or assumptions.

## Completion Status

Only report:

```text
PROMPT_007 COMPLETE
```

if ALL requirements above are implemented and verified.

Otherwise report:

```text
PROMPT_007 NOT COMPLETE
```

and clearly list what remains.

Do not modify unrelated modules or upgrade/downgrade project versions.