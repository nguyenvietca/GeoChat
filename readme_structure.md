# GeoChat — Project Structure & Technical Overview

> Cross-platform location-based social chat application.
>
> **Target platforms:** Web + Mobile  
> **Development style:** Beginner-friendly + Vibe Coding  
> **Architecture:** Modular Monolith  
> **Backend:** Java 21 + Spring Boot  
> **Database:** PostgreSQL + PostGIS  
> **Realtime:** Spring WebSocket  
> **Frontend:** React + Vite + TypeScript  
> **Mobile:** React Native + Expo

---

## 1. Project Goal

GeoChat allows users to:

- Find nearby users on a map.
- Search for users.
- Send and receive friend requests.
- Chat 1-to-1 in realtime.
- Create and manage group chats.
- Share a temporary location.
- Control whether other users can discover them.
- Receive realtime/push notifications.

The current project is intended to evolve from the existing web MVP into a **Web + Mobile application with a shared Spring Boot backend**.

The existing MVP behavior should be preserved unless a new product specification explicitly changes it.

---

## 2. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │       GeoChat        │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
              ┌──────▼──────┐               ┌──────▼──────┐
              │    Web      │               │   Mobile    │
              │ React + TS  │               │ React Native│
              │ Vite        │               │ Expo        │
              └──────┬──────┘               └──────┬──────┘
                     │                             │
                     └──────────────┬──────────────┘
                                    │
                           REST API / WebSocket
                                    │
                            ┌───────▼────────┐
                            │  Spring Boot   │
                            │    Java 21     │
                            └───────┬────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
             ┌─────▼─────┐    ┌─────▼─────┐   ┌────▼─────┐
             │ PostgreSQL│    │   Redis*   │   │PostGIS   │
             │           │    │            │   │          │
             └───────────┘    └────────────┘   └──────────┘

* Redis is optional in the first phase and should be introduced only when needed.
```

---

## 3. Repository Structure

Recommended monorepo structure:

```text
geochat/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── mobile/
│       ├── app/
│       ├── src/
│       ├── assets/
│       ├── package.json
│       └── app.json
│
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/geochat/
│   │   │   └── resources/
│   │   └── test/
│   │
│   ├── pom.xml
│   └── README.md
│
├── packages/
│   ├── types/
│   ├── api/
│   ├── validation/
│   └── config/
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── docs/
│   ├── product/
│   │   ├── features.md
│   │   ├── business-rules.md
│   │   └── user-flows.md
│   │
│   └── technical/
│       ├── architecture.md
│       ├── database.md
│       ├── realtime.md
│       └── security.md
│
├── AGENTS.md
├── README.md
└── readme_structure.md
```

---

## 4. Backend Structure

Backend uses a **modular monolith**.

Do not start with microservices.

```text
backend/src/main/java/com/geochat/

├── GeoChatApplication.java
│
├── common/
│   ├── exception/
│   ├── response/
│   ├── security/
│   ├── validation/
│   └── config/
│
├── auth/
│   ├── AuthController.java
│   ├── AuthService.java
│   ├── AuthRepository.java
│   ├── JwtService.java
│   └── dto/
│
├── user/
│   ├── UserController.java
│   ├── UserService.java
│   ├── UserRepository.java
│   ├── User.java
│   └── dto/
│
├── location/
│   ├── LocationController.java
│   ├── LocationService.java
│   ├── LocationRepository.java
│   ├── UserLocation.java
│   └── dto/
│
├── friend/
│   ├── FriendController.java
│   ├── FriendService.java
│   ├── FriendRequestRepository.java
│   ├── FriendshipRepository.java
│   └── dto/
│
├── chat/
│   ├── ChatController.java
│   ├── ChatWebSocketController.java
│   ├── ChatService.java
│   ├── MessageRepository.java
│   ├── Message.java
│   └── dto/
│
├── group/
│   ├── GroupController.java
│   ├── GroupService.java
│   ├── GroupRepository.java
│   ├── GroupMemberRepository.java
│   ├── GroupMessageRepository.java
│   └── dto/
│
└── notification/
    ├── NotificationService.java
    └── dto/
```

### Standard request flow

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL
```

Business logic belongs primarily in the **Service layer**.

Controllers should remain thin.

---

## 5. Frontend Structure

### Web

```text
apps/web/src/

├── app/
│   ├── router/
│   └── providers/
│
├── components/
│   ├── common/
│   ├── map/
│   ├── chat/
│   ├── friend/
│   └── group/
│
├── features/
│   ├── auth/
│   ├── nearby/
│   ├── friends/
│   ├── chat/
│   └── groups/
│
├── hooks/
├── services/
├── stores/
├── types/
└── main.tsx
```

### Mobile

```text
apps/mobile/

├── app/
│   ├── (auth)/
│   ├── (tabs)/
│   ├── chat/
│   └── group/
│
├── src/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   ├── stores/
│   └── types/
│
└── assets/
```

Web and Mobile should share **business concepts and types**, but should not be forced to share every UI component.

---

## 6. Shared Packages

Shared code should be kept small and intentional.

```text
packages/

├── types/
│   ├── user.ts
│   ├── location.ts
│   ├── message.ts
│   ├── friend.ts
│   └── group.ts
│
├── api/
│   ├── endpoints.ts
│   └── client.ts
│
├── validation/
│   └── schemas.ts
│
└── config/
    └── constants.ts
```

Rules:

1. Do not duplicate shared types unnecessarily.
2. Do not put platform-specific UI into shared packages.
3. Do not put backend Java code into frontend packages.
4. Keep shared packages small enough for beginners to understand.

---

## 7. Database

Primary database:

```text
PostgreSQL
    +
PostGIS
```

Core tables:

```text
users
profiles
user_locations

friend_requests
friendships

conversations
messages

groups
group_members
group_messages

notifications
```

### Location

Use PostGIS for nearby search.

Conceptually:

```text
user_locations
├── user_id
├── location
└── updated_at
```

`location` should represent a geographic point.

Nearby search should be performed by the backend/database rather than calculating every distance in frontend code.

---

## 8. Authentication & Authorization

Use:

```text
Spring Security
+
JWT
```

Basic flow:

```text
Login
  ↓
Spring Security
  ↓
JWT
  ↓
Web / Mobile
  ↓
Authorization: Bearer <token>
  ↓
Authenticated user
```

Important rules:

- Never trust `userId` supplied by the client for authorization.
- Always derive the authenticated user from the security context.
- Verify ownership/membership on the backend.
- Group owner actions must be checked server-side.
- Message history must verify the user has permission to access it.
- Secrets must never be stored in frontend code.

---

## 9. Realtime

Use Spring WebSocket.

Primary realtime features:

```text
1-to-1 message
Group message
Typing indicator
Friend request
Friend accepted
Friend removed
Presence
Group membership changes
```

Recommended conceptual flow:

```text
WebSocket
    ↓
WebSocket Controller
    ↓
Service
    ↓
Repository
    ↓
Database

Service/Event
    ↓
WebSocket broadcast
    ↓
Clients
```

Do not put business rules directly inside the WebSocket controller.

REST and WebSocket should reuse the same services where possible.

---

## 10. Location & Privacy

The application should support:

```text
Location permission
Current location
Manual location
Nearby search
Search radius
Discoverability
```

Initial radius options:

```text
1 km
2 km
5 km
10 km
50 km
```

The existing MVP uses a default radius of 1 km and supports an API range of 0.1–100 km. Preserve this behavior unless the product specification changes it. fileciteturn0file0L35-L49

Location visibility should remain an explicit product rule.

Do not log precise user coordinates unnecessarily.

---

## 11. Core Business Rules

The existing MVP contains several rules that should be preserved.

### Discoverability

A user who disables discoverability should not appear in nearby/user discovery results.

### Nearby

Nearby users are filtered by:

```text
location
+
radius
+
discoverability
```

Friends who are online may be shown outside the radius according to the existing product behavior.

### First-contact chat

Before users are connected:

```text
Maximum 5 messages
```

Sending the first message may create a friend request.

After the connection is accepted, normal chat limits apply according to the product specification. fileciteturn0file0L57-L69

### Group ownership

The group owner can:

- Add members.
- Remove members.
- Delete the group.
- Transfer ownership when leaving.

An owner cannot simply leave without selecting a replacement owner. fileciteturn0file0L75-L89

These rules should be documented separately in:

```text
docs/product/business-rules.md
```

---

## 12. API Design

REST API is the main client/backend contract.

Initial API concepts:

```text
POST   /api/auth/register
POST   /api/auth/login

POST   /api/location/update
GET    /api/location/nearby

GET    /api/users/search

GET    /api/friend-requests
GET    /api/friends/{id}/status
DELETE /api/friends/{id}

GET    /api/messages/{userId}

GET    /api/groups
POST   /api/groups
GET    /api/groups/{id}/members
POST   /api/groups/{id}/members
DELETE /api/groups/{id}/members/{userId}
POST   /api/groups/{id}/leave
DELETE /api/groups/{id}
GET    /api/groups/{id}/messages
```

These endpoints are based on the current MVP contract and can be revised during the v2 API design. fileciteturn0file0L233-L283

---

## 13. Development Phases

Do not implement everything at once.

### Phase 1 — Backend foundation

```text
Java 21
Spring Boot
PostgreSQL
Flyway
Spring Security
JWT
Validation
Global exception handling
```

### Phase 2 — Account

```text
Register
Login
Logout
Profile
Discoverability
```

### Phase 3 — Nearby

```text
Location permission
Location update
PostGIS
Nearby search
Radius
Map
```

### Phase 4 — Friends

```text
Search
Send request
Accept
Cancel
Remove
```

### Phase 5 — Chat

```text
1-to-1 chat
Message history
WebSocket
Typing
Unread
5-message first-contact rule
```

### Phase 6 — Groups

```text
Create group
Add member
Remove member
Leave group
Transfer owner
Group chat
Delete group
```

### Phase 7 — Web

```text
React
Vite
Responsive UI
Map
Chat
Groups
```

### Phase 8 — Mobile

```text
React Native
Expo
Android
iOS
Push notifications
Mobile location permissions
```

### Phase 9 — Production hardening

```text
Redis if required
Rate limiting
Security review
Observability
Performance testing
Integration testing
Deployment
Backup
```

---

## 14. Testing Strategy

### Backend

Use:

```text
JUnit
Spring Boot Test
Testcontainers
```

Test levels:

```text
Unit test
    ↓
Service test
    ↓
Repository/integration test
    ↓
API integration test
```

Important scenarios:

- Authentication.
- Invalid JWT.
- Authorization.
- Nearby search.
- Discoverability.
- Friend request lifecycle.
- 5-message first-contact limit.
- Group owner permissions.
- Group membership permissions.
- Message history permissions.
- WebSocket authentication.
- Realtime message delivery.

---

## 15. Vibe Coding Rules

The project is designed to be AI-assisted, but generated code must follow the architecture.

### Rule 1 — Understand before modifying

Before changing code, inspect:

```text
feature
→ controller
→ service
→ repository
→ entity
→ migration
```

### Rule 2 — Small changes

Prefer:

```text
1 feature
→ 1 small change
→ run tests
→ review
→ commit
```

instead of generating a large amount of code at once.

### Rule 3 — Reuse existing patterns

Before creating a new class/library/pattern:

```text
Search existing project
        ↓
Find similar implementation
        ↓
Follow existing pattern
```

### Rule 4 — No unnecessary dependencies

Do not add a library simply because it makes one small task easier.

### Rule 5 — Business rules are explicit

If a requirement is a business rule, document it in:

```text
docs/product/business-rules.md
```

Do not hide important rules inside UI code.

### Rule 6 — Security is backend responsibility

Never trust:

```text
userId
groupId
role
owner
permission
```

from the client without server-side validation.

---

## 16. AI Coding Guidelines

AI agents should read these files before making substantial changes:

```text
README.md
readme_structure.md
AGENTS.md
docs/product/business-rules.md
docs/technical/architecture.md
```

For a feature request, the preferred workflow is:

```text
Requirement
    ↓
Identify module
    ↓
Read business rules
    ↓
Inspect existing implementation
    ↓
Implement smallest change
    ↓
Run tests
    ↓
Review generated code
```

AI should not:

- Introduce microservices without a requirement.
- Replace the architecture without discussion.
- Add random dependencies.
- Move business logic into controllers.
- Trust client-side authorization.
- Store secrets in frontend code.
- Log precise location data unnecessarily.
- Rewrite unrelated modules.

---

## 17. Definition of Done

A feature is not considered complete just because the UI works.

Minimum:

```text
[ ] Backend implemented
[ ] Authorization checked
[ ] Validation added
[ ] Database migration added if needed
[ ] Business rule documented
[ ] API contract documented
[ ] Unit/integration tests added
[ ] Web UI implemented if applicable
[ ] Mobile UI implemented if applicable
[ ] Error handling implemented
[ ] Existing tests still pass
```

---

## 18. Initial Tech Stack Summary

```text
Frontend Web
    React
    Vite
    TypeScript

Mobile
    React Native
    Expo
    TypeScript

Backend
    Java 21
    Spring Boot
    Spring Security
    Spring Data JPA
    Hibernate
    WebSocket

Database
    PostgreSQL
    PostGIS
    Flyway

Optional infrastructure
    Redis

Testing
    JUnit
    Spring Boot Test
    Testcontainers
    Playwright

Architecture
    Modular Monolith
```

---

## 19. Architecture Principles

The project should follow these principles:

```text
Simple > clever
Modular > microservices
Explicit > magic
Small changes > huge rewrites
Backend authorization > frontend assumptions
Shared business concepts > duplicated logic
Tests > manual confidence
Documentation > hidden assumptions
```

The primary goal is to create a project that a beginner can understand and AI can assist with effectively, while keeping the technical foundation strong enough to evolve into a real Web + Mobile application.
