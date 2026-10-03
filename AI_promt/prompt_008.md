# PROMPT 008 — USER DISCOVERY & SEARCH

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

PROMPT_007 has been completed and verified.

---

# Goal

Implement a simple authenticated user discovery/search API.

The purpose is to allow a logged-in user to find other GeoChat users and then use the existing Friend API to send friend requests.

This milestone is BACKEND ONLY.

Do NOT implement:
- Chat
- Group
- Notification
- WebSocket
- Realtime presence
- Friend recommendation
- AI recommendation
- Map UI
- Frontend
- Mobile UI
- Full-text search infrastructure such as Elasticsearch/OpenSearch
- Redis

Keep the implementation simple and PostgreSQL-based.

---

# 1. User Discovery Module

Use the existing `user` module if it already exists.

Do NOT create a duplicate user-management system.

Follow the existing project package conventions.

Possible structure:

```text
user
├── controller
├── service
├── repository
├── entity
└── dto
```

If the existing project already has these layers, extend them rather than creating duplicates.

---

# 2. Search API

Add an authenticated endpoint:

```http
GET /api/v1/users/search?q={query}
```

Example:

```http
GET /api/v1/users/search?q=nguyen
```

The current user is obtained from JWT.

Do not accept a `userId` representing the current user from the client.

---

# 3. Search Behavior

Search should support the user's existing public identity fields.

Prefer searching:

```text
displayName
username
```

ONLY if those fields already exist in the current User model.

Do not invent unnecessary new profile fields.

If the project currently has only one suitable public identifier, use that field.

Search should be:

- case-insensitive
- partial match
- trimmed
- deterministic

Example:

```text
"nguyen"
```

can match:

```text
Nguyen Van A
nguyenvana
NGUYEN_B
```

depending on which searchable fields actually exist.

Do not make search accent-insensitive unless the current PostgreSQL/database setup already supports it cleanly.

Do not add PostgreSQL extensions solely for this feature unless clearly necessary.

---

# 4. Validation

The query parameter must be validated.

Rules:

- authenticated request required
- trim whitespace
- reject blank query
- define a reasonable minimum length, e.g. 2 characters
- define a reasonable maximum length, e.g. 100 characters
- do not allow an unlimited query string

If the project's existing validation/error conventions use different values, follow those conventions.

Do not silently turn an empty query into "return all users".

---

# 5. Search Result

Return only public information required for discovery.

Example:

```json
{
  "items": [
    {
      "userId": "xxx",
      "displayName": "Nguyen Van A",
      "username": "nguyenvana"
    }
  ]
}
```

Only include fields that actually exist in the User model.

NEVER return:

- password
- password hash
- JWT
- refresh token
- authentication secrets
- internal security fields
- private database fields
- exact location
- latitude
- longitude

Do not expose sensitive user data simply because it exists in the entity.

---

# 6. Exclude Current User

The current authenticated user should NOT appear in their own search results.

For example:

```text
Current user = A

Search "Nguyen"
```

If A matches the query, A must still be excluded.

Perform this filtering in the database query where practical.

Do not load all users and filter them in Java.

---

# 7. Friend / Request Status

Do not create a new friendship system.

However, if the existing Friend module already has a clean way to determine relationship status, consider returning a simple status field.

For example:

```json
{
  "userId": "xxx",
  "displayName": "User B",
  "username": "userb",
  "relationship": "NONE"
}
```

Possible values:

```text
NONE
PENDING_INCOMING
PENDING_OUTGOING
FRIENDS
```

Only implement this if it can be done cleanly using the existing Friend module.

Do NOT duplicate Friend business logic inside User search.

If adding relationship status creates unnecessary coupling or complexity, return only user information.

The core requirement of this milestone is USER SEARCH, not relationship management.

---

# 8. Result Ordering

Results must have deterministic ordering.

Prefer:

```text
displayName ASC
userId ASC
```

or the existing User search ordering convention.

Do not use random ordering.

If username is the primary searchable field, use an ordering consistent with the existing user model.

---

# 9. Limit Results

Never return an unlimited number of users.

Use a default limit, for example:

```text
20
```

and a maximum limit, for example:

```text
50
```

If the project already has a standard pagination/limit convention, reuse it.

For this milestone, simple limit-based pagination is sufficient.

Do NOT build a complex generic pagination framework unless one already exists.

Example:

```http
GET /api/v1/users/search?q=nguyen&limit=20&offset=0
```

If using `offset`, validate it:

```text
offset >= 0
```

and enforce a reasonable maximum result size.

---

# 10. Database Query

Search/filtering must happen in PostgreSQL.

Do NOT:

```text
SELECT all users
→ load into Java
→ filter with streams
```

Use a database query that:

1. searches the appropriate public fields
2. excludes current user
3. applies ordering
4. applies limit/offset

Use parameterized queries.

Do not concatenate raw user input into SQL.

---

# 11. Indexing

Inspect the existing User table/schema before adding indexes.

Do not blindly add indexes.

For a simple implementation, an index strategy appropriate to the actual query is preferred.

If the current search uses:

```sql
LOWER(display_name) LIKE ...
```

consider whether an appropriate PostgreSQL index is useful.

However:

DO NOT introduce:

- Elasticsearch
- OpenSearch
- Redis
- pg_trgm
- complex search infrastructure

unless the current project already uses it or there is a clear technical requirement.

Keep this milestone beginner-friendly.

---

# 12. Security

The endpoint must require authentication.

A user who is not authenticated must not be able to search users.

Search results must expose only public profile information.

Do not log:

- JWT
- authorization header
- passwords
- password hashes
- sensitive personal information

Do not expose database entities directly from the controller.

Use DTOs.

---

# 13. API Error Handling

Follow the existing project's error response format.

Handle at minimum:

```text
401 Unauthorized
```

for unauthenticated requests.

Validation errors should follow the existing validation/error response convention.

Examples:

- missing query
- blank query
- query too short
- query too long
- invalid limit
- invalid offset

Do not introduce a completely new error format.

---

# 14. Tests

Add automated tests.

At minimum cover:

### Authentication

- authenticated user can search
- unauthenticated user receives 401

### Query validation

- missing q
- blank q
- whitespace-only q
- query shorter than minimum
- query longer than maximum
- valid query

### Matching

- display name partial match
- username partial match, if username exists
- case-insensitive matching

### Security

- current user is excluded
- password/hash are never returned
- private/internal fields are never returned
- exact location is never returned

### Ordering

- results are deterministic
- ordering matches the defined rule

### Limit

- default limit works
- maximum limit is enforced
- offset works if implemented

### Empty result

A valid query with no matching users should return:

```json
{
  "items": []
}
```

Do not treat this as an error.

---

# 15. Integration Testing

Prefer PostgreSQL integration tests for the actual search query.

The test should verify the real database behavior instead of only mocking the repository.

At minimum create test users such as:

```text
Nguyen Van A
Nguyen Van B
Tran Van C
```

Then verify:

```text
q=nguyen
```

returns the appropriate users.

Also verify the authenticated user is excluded.

---

# 16. API Documentation

If OpenAPI/Swagger already exists, document:

```http
GET /api/v1/users/search
```

Document:

```text
q
limit
offset
```

and the response structure.

---

# 17. Do Not Modify Friend Logic

The Friend module was completed in PROMPT_007.

Do not refactor or rewrite it unnecessarily.

If relationship status is implemented, reuse existing Friend services/repositories where practical.

Avoid circular dependencies such as:

```text
User -> Friend -> User -> Friend
```

If the relationship status requires significant architectural changes, skip it for this milestone.

---

# 18. Scope Protection

DO NOT implement:

- chat
- direct messaging
- group search
- friend recommendation
- "people you may know"
- nearby user search
- location-based ranking
- friend suggestions
- notification
- online/offline status
- WebSocket
- profile editing
- avatar upload
- blocking
- reporting
- social graph analytics
- Elasticsearch/OpenSearch
- Redis

The goal is only:

```text
Authenticated User Search
```

---

# 19. Validation

Run:

```powershell
cd "D:\project\GeoChat\backend"

.\mvnw.cmd -version

.\mvnw.cmd test

.\mvnw.cmd -DskipTests compile
```

All commands must succeed.

Make sure Flyway migrations still run successfully.

---

# 20. Manual Verification

After automated tests pass:

1. Start PostgreSQL.
2. Start the backend.
3. Register User A.
4. Register User B.
5. Register User C.
6. Login as User A.
7. Search for User B by display name.
8. Search using partial text.
9. Search using different letter casing.
10. Verify User A does not appear in results.
11. Verify password/hash/token are not returned.
12. Verify an unknown query returns an empty list.
13. Verify invalid query parameters return validation errors.
14. Verify limit/offset behavior if implemented.

---

# 21. Final Report

At the end, report:

## Changed

List files/modules created or modified.

## API

Document:

```text
GET /api/v1/users/search
```

including parameters and response.

## Search

Explain:

- searchable fields
- matching behavior
- case sensitivity
- ordering
- limit/pagination

## Database

Explain the query and any indexes/migrations added.

## Security

Explain:

- authentication
- current-user exclusion
- fields exposed in response

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

List remaining issues or assumptions.

## Completion Status

Only report:

```text
PROMPT_008 COMPLETE
```

if ALL requirements above are implemented and verified.

Otherwise report:

```text
PROMPT_008 NOT COMPLETE
```

and clearly list what remains.

Do not modify unrelated modules or upgrade/downgrade project versions.