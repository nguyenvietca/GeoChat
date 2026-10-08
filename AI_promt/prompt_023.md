# PROMPT_023 — End-to-End Integration & Security Hardening

## Context

GeoChat is a mobile + web application with a Spring Boot backend.

The following milestones have already been implemented:

- PROMPT_001 — Project Skeleton
- PROMPT_002 — Backend Build Foundation
- PROMPT_003 — PostgreSQL/Flyway Foundation
- PROMPT_004 — User & Authentication
- PROMPT_005 — Current Location
- PROMPT_006 — Nearby Search
- PROMPT_007 — Friend Foundation
- PROMPT_008 — User Discovery & Search
- PROMPT_009 — Direct Chat Foundation
- PROMPT_010 — Backend WebSocket Realtime Chat
- PROMPT_011 — Notification Foundation
- PROMPT_012 — Mobile Foundation & Backend Integration
- PROMPT_013 — Mobile Search & Nearby
- PROMPT_014 — Mobile Friends
- PROMPT_015 — Mobile Direct Chat & Realtime Messaging
- PROMPT_016 — Mobile Notifications
- PROMPT_017 — Mobile Profile & Settings
- PROMPT_018 — Mobile Push Notifications
- PROMPT_019 — Web Foundation, Auth, Search & Nearby
- PROMPT_020 — Web Friends, Direct Chat & WebSocket
- PROMPT_021 — Web Notifications & Realtime Notifications
- PROMPT_022 — Web Profile & Settings

The application now has the core functionality across:

- Backend
- Mobile
- Web

This prompt is a **stabilization milestone**.

Do NOT add new product features.

---

# Goal

Perform an end-to-end integration, security, authorization, and regression review across the existing GeoChat system.

The goal is to make sure that:

```text
Mobile
   ↓
Backend API
   ↓
PostgreSQL/PostGIS
   ↑
Web
```

and:

```text
Mobile/Web
   ↓
WebSocket
   ↓
Backend
```

behave consistently and securely.

Fix real problems found during the review.

Do not rewrite working architecture without a concrete reason.

---

# 1. Inspect Before Coding

Before changing anything, inspect:

### Backend

- authentication
- JWT generation/validation
- security configuration
- controllers
- services
- repositories
- DTOs
- entity relationships
- database migrations
- WebSocket configuration
- WebSocket authentication
- notification creation
- location APIs
- friend APIs
- chat APIs
- user APIs
- CORS configuration
- environment configuration
- exception handling

### Web

Inspect:

- API client
- authentication state
- protected routes
- token handling
- WebSocket/STOMP client
- notification subscriptions
- logout cleanup
- API error handling
- route protection

### Mobile

Inspect:

- API client
- authentication state
- token storage
- navigation guards
- WebSocket/STOMP client
- notification handling
- logout cleanup
- location permission handling
- push notification integration

Do not assume the current implementation exactly matches previous prompt descriptions.

Use the actual code as the source of truth.

---

# 2. Backend Authentication Hardening

Review the authentication implementation.

Verify:

- passwords are hashed securely
- passwords are never logged
- JWT secret is not hardcoded
- JWT secret is loaded from environment/configuration
- weak development defaults are not silently used in production
- JWT expiration is enforced
- invalid JWT is rejected
- expired JWT is rejected
- missing JWT is rejected for protected APIs
- malformed JWT is rejected
- user-not-found token scenarios are handled safely

Do not expose authentication internals in API responses.

---

# 3. Authentication Validation

Review:

### Registration

Verify:

- required fields
- invalid email if email validation exists
- blank username/display name
- duplicate username/email where applicable
- password validation
- malformed input

### Login

Verify:

- wrong password
- unknown user
- invalid request
- missing credentials

Responses must be safe and should not unnecessarily reveal whether an account exists.

---

# 4. Authorization Audit

Audit every protected API.

At minimum verify:

### User

A user cannot modify another user's profile.

### Location

A user cannot create/update/delete another user's current location.

### Friend

A user cannot:

- accept another user's friend request
- reject another user's friend request
- cancel another user's outgoing request
- manipulate another user's friendship

### Chat

A user cannot:

- read another user's conversation
- send a message to a conversation they do not belong to
- subscribe to another user's private conversation

### Notification

A user cannot:

- read another user's notification
- mark another user's notification as read
- mark another user's notifications as read-all

### Profile

A user cannot modify another user's profile through request parameters or IDs.

Authorization must be enforced on the backend.

Do not rely only on frontend route protection.

---

# 5. IDOR / Ownership Review

Explicitly review endpoints containing IDs.

Examples:

```text
/users/{id}
/friends/{id}
/requests/{id}
/chats/{conversationId}
/notifications/{notificationId}
```

Check whether changing the ID allows access to another user's data.

Test with at least two users:

```text
User A
User B
```

User A must never be able to access User B's private resources by changing an ID.

Fix any real IDOR vulnerability found.

---

# 6. WebSocket Security Audit

Review the existing WebSocket/STOMP implementation.

Verify:

- JWT authentication is required
- invalid JWT is rejected
- expired JWT is rejected
- unauthenticated connection cannot access protected destinations
- conversation subscription requires membership
- message sending requires conversation membership
- one user cannot subscribe to another user's private conversation
- notification subscription is user-specific
- users cannot spoof another user's identity

Verify that authorization happens server-side.

Do not trust client-supplied user IDs.

---

# 7. WebSocket Reconnect & Cleanup

Review both Web and Mobile.

Verify:

### Login

WebSocket can connect normally.

### Logout

WebSocket connections/subscriptions are cleaned up.

### Token expiration

The application does not continue operating as an authenticated realtime client.

### Reconnect

Existing reconnect logic does not create duplicate subscriptions.

### Notification subscriptions

There is no subscription multiplication after:

- reconnect
- navigating between pages
- opening/closing chat
- logging out/in

---

# 8. REST + WebSocket Message Deduplication

Review the existing chat implementation.

The expected flow is approximately:

```text
POST message
    ↓
Backend persists message
    ↓
Backend broadcasts message
    ↓
Sender receives WebSocket event
```

Ensure the same message does not appear twice.

Use the backend message ID or another stable server-generated identifier.

Do not use fragile UI-only deduplication such as comparing message text/timestamps.

---

# 9. Notification Deduplication

Review notification handling on Web and Mobile.

Ensure that a notification received through:

- REST refresh
- WebSocket

does not appear twice.

Use the stable notification ID.

Verify unread count does not increase twice for the same notification.

---

# 10. API Contract Consistency

Compare backend DTOs/responses with:

- Web TypeScript types
- Mobile TypeScript types

Look for:

- renamed fields
- nullable fields
- enum mismatches
- number/string mismatches
- date/time format mismatches
- missing fields
- incorrect endpoint paths
- incorrect HTTP methods
- incorrect request payloads

Fix the client implementations to match the actual backend contract.

Do not change the backend API merely to make the frontend assumption convenient unless there is a genuine backend defect.

---

# 11. Error Response Consistency

Review backend exception handling.

Ensure common failures return predictable responses for:

- 400
- 401
- 403
- 404
- 409
- 422, if used
- 500

Do not expose:

- stack traces
- SQL errors
- internal class names
- sensitive configuration
- passwords
- JWT secrets

Frontend applications should be able to distinguish authentication errors from validation/business errors.

Do not redesign the entire error system if the existing one is already adequate.

---

# 12. Database Integrity Review

Review database constraints and migrations.

Verify important relationships have appropriate:

- primary keys
- foreign keys
- unique constraints
- indexes
- NOT NULL constraints where required
- status constraints where appropriate

Pay special attention to:

### User

Unique identifiers where required.

### Friendship

Prevent duplicate active relationships.

### Direct Conversation

Prevent duplicate direct conversations for the same pair.

### Message

Valid conversation relationship.

### Notification

Valid recipient/reference relationship.

### Location

Correct user ownership.

Do not create unnecessary indexes without evidence they are useful.

---

# 13. Location & Privacy Review

Review location-related APIs.

Verify:

- authenticated user is the source of current location
- users cannot update another user's location
- nearby search excludes the current user
- database-side radius filtering is used
- distance is calculated correctly
- raw coordinates are not unnecessarily returned to clients
- private location data is not exposed through user search
- unauthorized users cannot retrieve another user's exact location

Do not add map functionality in this prompt.

---

# 14. CORS & Environment Configuration

Review CORS configuration.

Ensure development origins are configurable.

Do not hardcode production assumptions.

Review environment/configuration for:

- database URL
- database username/password
- JWT secret
- JWT expiration
- API base URL
- WebSocket URL
- mobile environment configuration
- web environment configuration
- push notification configuration

Sensitive values must not be committed to source control.

Check:

```text
.env
.env.example
application.yml
application.properties
docker-compose files
```

Do not remove `.env.example` or equivalent developer documentation.

Use safe placeholder values.

---

# 15. Logging Review

Search for accidental sensitive logging.

Remove or fix logs containing:

- passwords
- password hashes
- JWT tokens
- authorization headers
- private location coordinates
- sensitive personal information

Keep useful operational logs.

Do not disable logging globally.

---

# 16. Input Validation

Review important API inputs.

Ensure validation exists where appropriate for:

- registration
- login
- profile update
- friend request
- location
- chat message
- notification actions
- pagination
- nearby radius

Prevent obviously invalid values such as:

- negative radius
- invalid pagination values
- blank message
- malformed identifiers
- invalid coordinates

Use existing validation conventions.

Do not over-engineer validation for internal trusted values.

---

# 17. Mobile Security Review

Review token handling.

Ensure:

- access token is stored using the existing secure mechanism
- token is not stored in plain persistent storage unnecessarily
- token is not logged
- logout clears token
- logout clears authenticated user state
- logout cleans realtime connections
- expired authentication redirects appropriately

Do not replace the existing storage library unless there is a concrete security/compatibility problem.

---

# 18. Web Security Review

Verify:

- protected routes work
- unauthenticated users cannot access protected pages
- logout clears authentication state
- sensitive tokens are not rendered
- API authorization errors are handled
- WebSocket authentication is not bypassable through UI navigation

Do not assume hiding a route is equivalent to backend authorization.

---

# 19. Backend Automated Tests

Add missing tests for high-risk areas.

Prioritize:

### Authentication

- invalid credentials
- expired JWT
- invalid JWT
- missing JWT

### Authorization

- User A accessing User B's resource
- unauthorized conversation access
- unauthorized notification access
- unauthorized friend-request action

### Chat

- non-member cannot read conversation
- non-member cannot send message

### WebSocket

- unauthorized connection
- unauthorized subscription
- unauthorized send

### Location

- user ownership
- nearby privacy

Do not chase arbitrary test coverage percentages.

Focus on security boundaries and important business rules.

---

# 20. Web Tests

Add/update tests for:

- protected route
- logout
- API 401 handling
- notification deduplication
- message deduplication
- WebSocket cleanup
- authenticated user state

Use the existing test framework.

Do not introduce a new testing framework unless absolutely necessary.

---

# 21. Mobile Tests

Add/update tests for:

- auth state
- logout
- token cleanup
- API 401 behavior
- message deduplication
- notification deduplication
- realtime cleanup where the current test setup supports it

Keep tests proportional to the existing project architecture.

---

# 22. End-to-End Manual Verification

Use at least two accounts:

```text
User A
User B
```

Verify the complete flow:

### Authentication

1. Register A.
2. Register B.
3. Login A.
4. Login B.
5. Logout.
6. Login again.

### Search

1. Search for the other user.
2. Verify private fields are not exposed.

### Nearby

1. Set current location.
2. Search nearby.
3. Verify the other user appears only when appropriate.
4. Verify exact coordinates are not exposed.

### Friendship

1. A sends friend request to B.
2. B receives notification.
3. B accepts request.
4. A receives acceptance notification.
5. Verify both users see the friendship.

### Chat

1. A opens chat with B.
2. A sends message.
3. B receives realtime message.
4. B replies.
5. A receives realtime message.
6. Verify no duplicate messages.

### Notifications

1. Trigger friend/message events.
2. Verify notification appears once.
3. Verify unread count.
4. Mark notification read.
5. Verify unread count updates.
6. Refresh and verify state remains correct.

### Logout

1. Logout.
2. Verify protected routes are inaccessible.
3. Verify WebSocket is disconnected.
4. Login again.
5. Verify realtime functionality works again.

---

# 23. Cross-Platform Regression

Verify the same backend behavior from:

```text
Mobile → Backend
Web    → Backend
```

Important flows:

- authentication
- profile
- friends
- chat
- notifications
- location

The backend must remain the single source of truth.

Do not implement platform-specific business rules.

---

# 24. Build & Validation

Run the appropriate validation commands for all existing applications.

Backend:

```bash
.\mvnw.cmd test
```

Web:

```bash
npm run build
```

Run the existing typecheck/test commands if configured.

Mobile:

```bash
npx tsc --noEmit
```

Also run existing mobile tests if configured.

Fix errors introduced by this prompt.

---

# 25. Scope Protection

This prompt is ONLY for:

- integration review
- security hardening
- authorization
- authentication validation
- WebSocket security
- API contract consistency
- database integrity review
- error handling
- logging review
- environment/configuration review
- regression testing
- test improvements

Do NOT implement:

- Group Chat
- Map UI
- Media messages
- File sharing
- Reactions
- Typing indicators
- Read receipts
- New social features
- New notification types
- New authentication providers
- New UI redesign
- Major architecture migration
- New state-management framework
- Microservices migration
- Kubernetes/deployment infrastructure

If you discover a larger architectural problem, document it in the final report instead of expanding scope.

---

# 26. Final Report

When finished, report:

1. Security issues found.
2. Security issues fixed.
3. Authorization issues found/fixed.
4. Authentication issues found/fixed.
5. WebSocket issues found/fixed.
6. API contract mismatches found/fixed.
7. Database integrity issues found/fixed.
8. Sensitive logging issues found/fixed.
9. Environment/configuration issues found/fixed.
10. Tests added/updated.
11. Backend test result.
12. Web build/typecheck result.
13. Mobile typecheck/test result.
14. Manual two-account verification result.
15. Remaining known limitations.
16. Recommended follow-up work, if any.

Do not hide unresolved issues.

Clearly distinguish:

```text
Fixed
Not Applicable
Known Limitation
Requires Future Work
```

At the very end, use exactly one of:

```text
PROMPT_023 COMPLETE
```

or

```text
PROMPT_023 NOT COMPLETE
```

Only report `PROMPT_023 COMPLETE` when the integration/security review and applicable validation have actually been completed.