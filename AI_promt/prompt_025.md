# PROMPT_025 — Group Chat Foundation

## Context

GeoChat is a mobile + web application with a Spring Boot backend.

The Core Phase has been completed through PROMPT_024.

Existing functionality includes:

- User authentication
- User profiles
- User search
- Current location
- Nearby users
- Friend requests
- Friends
- Direct conversations
- Direct messaging
- WebSocket/STOMP realtime messaging
- Notifications
- Mobile push notifications
- Web Profile & Settings
- Security and authorization hardening
- UX and production-readiness improvements

The existing Chat architecture currently supports **direct conversations**.

Now begin Phase 2 with the first major social feature:

**Group Chat.**

---

# Goal

Implement the backend foundation and API for **Group Conversations**.

A group conversation should allow multiple users to:

- create a group
- become a member
- view group information
- view group members
- send text messages
- receive realtime messages
- leave a group

The implementation must reuse the existing Chat, Message, WebSocket, Authentication, and Notification architecture wherever appropriate.

This prompt focuses on the **backend foundation only**.

Do NOT implement Web or Mobile group-chat UI in this prompt.

---

# 1. Inspect Before Coding

Before making changes, inspect the existing backend implementation.

Review:

- User module
- Friend module
- Chat module
- Conversation entity/model
- Conversation participant model
- Message model
- Chat service
- Chat controllers
- WebSocket configuration
- WebSocket authentication
- STOMP destinations
- Notification module
- database migrations
- authorization rules
- existing Chat tests

Do not assume the previous direct-chat implementation exactly matches the expected architecture.

Reuse the actual project structure.

Do not create a second chat architecture for groups.

---

# 2. Fixed Technology Constraints

Keep the existing backend stack:

- Java 21
- Spring Boot 4.1.0
- Maven Wrapper
- PostgreSQL
- PostGIS
- Flyway
- JWT
- Spring WebSocket/STOMP
- existing modular monolith architecture

Do not introduce:

- microservices
- Kafka
- Redis
- RabbitMQ
- another WebSocket framework
- another authentication system

unless an existing project dependency already requires it.

---

# 3. Group Conversation Model

Extend the existing conversation architecture to distinguish:

```text
DIRECT
GROUP
```

Reuse the existing conversation model if it already supports conversation types.

Do not create an entirely separate `GroupChat` messaging system if the existing Conversation/Message architecture can support it.

A group conversation should have at minimum:

- conversation ID
- conversation type
- group name
- creator/owner
- created timestamp
- updated timestamp where appropriate

Use the project's existing naming conventions.

---

# 4. Group Membership

A group must support multiple members.

Reuse the existing conversation participant architecture if possible.

A membership should represent at least:

- conversation
- user
- membership status if required by the existing architecture
- role if required
- joined timestamp

At minimum support these roles:

```text
OWNER
MEMBER
```

Do not implement complex role management yet.

---

# 5. Group Creation

Add an authenticated API for creating a group.

Example concept:

```text
POST /api/v1/groups
```

However:

**Inspect existing API conventions before choosing the final endpoint.**

Do not blindly use the example endpoint.

The request should contain the minimum information necessary, such as:

- group name
- initial member IDs

The authenticated user automatically becomes the group owner.

The creator must not need to add themselves manually.

---

# 6. Group Creation Rules

When creating a group:

1. Authenticate the requester.
2. Validate the group name.
3. Create the group conversation.
4. Add creator as `OWNER`.
5. Add valid initial members.
6. Persist everything transactionally.

If the project already enforces friendship for direct conversations, determine whether group membership should follow the same rule.

For the first implementation:

**Only allow adding users who are already friends with the creator.**

Do not allow arbitrary users to be added to a group.

The creator should not be duplicated if their ID appears in the request.

---

# 7. Group Size

Introduce a reasonable configurable maximum group size.

Do not hardcode the limit in multiple places.

For example:

```text
MAX_GROUP_MEMBERS = 100
```

The exact value should follow existing project conventions if one already exists.

The limit should be configuration-driven if practical.

If the request exceeds the limit:

- reject the request
- return an appropriate validation/business error
- do not partially create the group

---

# 8. Group Name Validation

Validate group names.

At minimum:

- required
- not blank
- reasonable maximum length
- trim unnecessary surrounding whitespace

Do not allow a group with an empty name.

Use backend validation.

Do not duplicate validation logic across controllers/services.

---

# 9. Group Information API

Add an authenticated endpoint for retrieving group information.

Conceptually:

```text
GET /api/v1/groups/{groupId}
```

The response should contain appropriate public group information such as:

- group ID
- group name
- owner
- member count
- created timestamp

Only group members may access private group information.

A non-member must receive an authorization error.

Do not expose unnecessary internal database fields.

---

# 10. Group Member API

Add an endpoint to retrieve group members.

Conceptually:

```text
GET /api/v1/groups/{groupId}/members
```

Only group members may access this information.

Return appropriate public user information.

Do not expose:

- password
- password hash
- JWT
- private security fields
- unnecessary internal fields

Use pagination if the existing project conventions require it.

---

# 11. Leave Group

Allow a member to leave a group.

Conceptually:

```text
POST /api/v1/groups/{groupId}/leave
```

Inspect existing REST conventions and use the project's preferred method/path.

Rules:

- MEMBER can leave.
- OWNER cannot simply leave if no ownership-transfer mechanism exists.

For this milestone, if the owner attempts to leave:

- reject the operation with a clear business error.

Do NOT implement ownership transfer yet.

---

# 12. Group Message Support

Reuse the existing Message model.

A group message should contain:

- message ID
- conversation ID
- sender
- text content
- created timestamp

Do not create a separate `GroupMessage` entity unless the current architecture absolutely requires it.

The same message infrastructure should support:

```text
DIRECT
GROUP
```

---

# 13. Send Group Message

Allow a group member to send a text message.

Reuse the existing chat message service where possible.

Rules:

- sender must be authenticated
- sender must be an active group member
- message must belong to the group conversation
- text cannot be blank
- persist message before realtime broadcast

A non-member must not be able to send a group message.

---

# 14. Group Message History

Reuse the existing message-history endpoint if its architecture supports conversation types.

Conceptually:

```text
GET /api/v1/chats/{conversationId}/messages
```

A group member can retrieve the group's message history.

A non-member must be rejected.

Do not create a duplicate message-history API unless the current architecture requires it.

---

# 15. WebSocket Group Messaging

Extend the existing STOMP implementation.

Do not create a second WebSocket endpoint.

Reuse the existing:

```text
/ws
```

or the actual configured endpoint.

The existing conversation destination should support both:

```text
DIRECT
GROUP
```

Conceptually:

```text
/app/chat/{conversationId}/send
/topic/chat/{conversationId}
```

Use the actual existing destination names from the codebase.

---

# 16. WebSocket Authorization

This is critical.

Before allowing a user to:

### Subscribe

Verify that the authenticated user is a member of the conversation.

### Send

Verify that the authenticated user is a member of the conversation.

Do not trust:

- user ID from the client
- conversation type from the client
- arbitrary destination paths

The backend must determine membership.

A non-member must not receive group messages through WebSocket.

---

# 17. Realtime Broadcast

When a group member sends a message:

```text
Client
   ↓
WebSocket
   ↓
Backend authorization
   ↓
Persist message
   ↓
Broadcast to group conversation
```

All currently connected group members should receive the message.

The sender may also receive the broadcast depending on the existing architecture.

Preserve the existing message delivery behavior.

---

# 18. Message Deduplication

Reuse the existing stable message ID.

Do not create group-specific deduplication logic.

The same message must not be duplicated because it was:

- created through REST
- received through WebSocket

Follow the existing direct-chat behavior.

---

# 19. Notifications

Extend the existing notification architecture carefully.

When a group message is sent, determine whether the current notification system can support group-message notifications.

For this milestone:

**Do not add push notification behavior for group messages unless the existing notification infrastructure already supports the required flow cleanly.**

If a new notification type is necessary, implement only the minimum backend support required.

Do not redesign the notification system.

Do not send a notification to the message sender.

Avoid creating an excessive number of notifications.

The final implementation should clearly document the chosen behavior.

---

# 20. Database Migration

Create the required Flyway migration(s).

Review the current schema before creating migrations.

Possible changes:

- conversation type
- group metadata
- participant role
- constraints/indexes

Use a new migration.

Do not modify an already-applied migration.

Ensure the migration works on a clean database.

---

# 21. Database Constraints

Add appropriate constraints/indexes.

At minimum consider:

### Conversation

- valid conversation type
- group name requirements where appropriate

### Participant

Prevent duplicate membership:

```text
conversation_id + user_id
```

should not create duplicate active membership.

### Message

Ensure valid conversation relationship.

Use database constraints where they provide real integrity protection.

---

# 22. Transaction Boundaries

Group creation should be transactional.

For example:

```text
Create conversation
      ↓
Create owner membership
      ↓
Create member memberships
```

If any step fails:

```text
ROLLBACK
```

Do not leave a partially-created group.

Follow the existing service transaction conventions.

---

# 23. Authorization Rules

Implement backend authorization for:

| Operation | Owner | Member | Non-member |
|---|---:|---:|---:|
| View group | ✅ | ✅ | ❌ |
| View members | ✅ | ✅ | ❌ |
| Send message | ✅ | ✅ | ❌ |
| View messages | ✅ | ✅ | ❌ |
| Leave group | ❌* | ✅ | ❌ |

`*` Owner leaving is intentionally unsupported in this milestone.

Do not rely on frontend checks.

---

# 24. REST Error Handling

Use the existing exception/error handling architecture.

Expected scenarios include:

- group not found
- not a member
- invalid group name
- invalid member IDs
- non-friend member
- group size exceeded
- owner attempting to leave
- invalid message
- unauthorized conversation access

Do not expose stack traces or internal database details.

---

# 25. Tests

Add comprehensive backend tests.

### Group creation

Test:

- successful group creation
- creator becomes owner
- initial members added
- duplicate creator ID handled
- duplicate member IDs handled
- non-friend cannot be added
- invalid member rejected
- empty group name rejected
- group name too long rejected
- maximum member limit enforced
- transaction rollback

### Group access

Test:

- owner can view group
- member can view group
- non-member cannot view group
- member can view members
- non-member cannot view members

### Group messaging

Test:

- member can send message
- owner can send message
- non-member cannot send message
- blank message rejected
- member can read message history
- non-member cannot read message history

### Leaving

Test:

- member can leave
- owner cannot leave
- non-member cannot leave

### Authorization

Use at least:

```text
User A = owner
User B = member
User C = non-member
```

Explicitly test User C attempting to access User A/B's group.

---

# 26. WebSocket Tests

Extend existing WebSocket tests.

Test:

### User A

Owner connects and subscribes.

### User B

Member connects and subscribes.

### User C

Non-member attempts to subscribe.

Expected:

```text
A → allowed
B → allowed
C → rejected
```

Then:

```text
A sends message
```

Expected:

```text
A receives/broadcasts according to existing behavior
B receives message
C receives nothing
```

Also test that User C cannot send a message to the group.

Use the existing WebSocket testing infrastructure.

---

# 27. Regression Tests

Ensure existing direct chat behavior remains unchanged.

At minimum verify:

- direct conversation creation
- direct message sending
- direct message history
- direct WebSocket messaging
- direct chat authorization
- notification behavior
- existing friend behavior

Do not break the existing direct-chat architecture while adding groups.

---

# 28. API Documentation

Update existing API documentation if the project has one.

Document:

- group creation
- group information
- group members
- leave group
- group messaging behavior
- authorization rules
- WebSocket behavior

Use the actual final endpoints, not the conceptual examples from this prompt.

---

# 29. Build & Validation

Run:

```bash
.\mvnw.cmd test
```

Also verify:

```bash
.\mvnw.cmd clean test
```

if practical.

Verify Flyway migrations against a clean database if the project has a supported local setup.

Do not declare completion if tests fail.

---

# 30. Scope Protection

This prompt is ONLY for the **Group Chat Backend Foundation**.

Implement:

- group conversation model
- group membership
- owner/member roles
- group creation
- group information
- group members
- leave group
- group text messages
- group message history
- group WebSocket messaging
- backend authorization
- database migrations
- tests
- API documentation

Do NOT implement:

- Web Group Chat UI
- Mobile Group Chat UI
- group avatar upload
- media messages
- file sharing
- message reactions
- typing indicators
- read receipts
- message editing
- message deletion
- pinned messages
- admin management UI
- ownership transfer
- invite links
- public groups
- group discovery
- advanced group permissions
- location sharing inside groups

These can be future milestones.

---

# 31. Final Report

When finished, report:

1. Files changed.
2. Database migrations added.
3. Conversation model changes.
4. Membership model changes.
5. New group APIs.
6. WebSocket changes.
7. Authorization rules implemented.
8. Notification behavior.
9. Tests added.
10. Direct-chat regression results.
11. Flyway migration result.
12. `.\mvnw.cmd test` result.
13. `.\mvnw.cmd clean test` result if executed.
14. Known limitations.
15. Future work identified but NOT implemented.

Clearly classify issues as:

```text
Fixed
Not Applicable
Known Limitation
Future Work
```

At the very end, use exactly one:

```text
PROMPT_025 COMPLETE
```

or:

```text
PROMPT_025 NOT COMPLETE
```

Only report `PROMPT_025 COMPLETE` when the backend group-chat foundation, authorization, migrations, tests, and regression checks have actually been completed.