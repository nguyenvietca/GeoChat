# PROMPT 012 — MOBILE FOUNDATION & BACKEND INTEGRATION

## Context

Project: GeoChat

Project direction:

- Mobile app
- Web app
- Spring Boot backend
- Beginner-friendly vibe coding
- Real technical foundation
- Incremental milestones

Backend architecture:

- Modular monolith
- Java 21
- Spring Boot 4.1.0
- Maven Wrapper / Maven 3.9.9
- PostgreSQL
- PostGIS
- Flyway
- JWT
- REST
- WebSocket/STOMP

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
- PROMPT_010 — Chat Realtime with WebSocket
- PROMPT_011 — Notification Foundation

PROMPT_011 has been completed and verified.

The backend must be treated as the source of truth.

---

# Goal

Start implementing the MOBILE application.

The goal of this milestone is to establish a clean mobile foundation that can communicate with the existing GeoChat backend.

Implement:

1. Mobile app structure
2. Environment/API configuration
3. HTTP client
4. Authentication API integration
5. Secure token storage
6. Authentication state
7. Basic navigation
8. Login screen
9. Register screen
10. Authenticated home screen
11. Logout
12. Basic error/loading handling

This milestone is primarily about FOUNDATION.

Do NOT implement the full GeoChat UI yet.

---

# 1. Inspect Existing Mobile Project First

Before changing code:

1. Inspect the existing `apps/mobile` or current mobile project directory.
2. Identify:
   - framework
   - package manager
   - TypeScript configuration
   - existing navigation
   - existing dependencies
   - existing folder structure
3. Reuse the existing mobile stack.

IMPORTANT:

Do NOT replace the mobile framework just because another framework is preferred.

Do NOT recreate the mobile project from scratch if a working skeleton already exists.

Preserve working configuration unless there is a concrete reason to change it.

---

# 2. Mobile Technology

Use the existing mobile technology detected in the project.

If the existing project is React Native + Expo + TypeScript:

Prefer:

```text
React Native
Expo
TypeScript
```

and use the appropriate Expo-compatible libraries.

Do not migrate to Flutter, Kotlin, Swift, or another framework.

If the project uses another established mobile stack, keep that stack.

---

# 3. Project Structure

Establish a beginner-friendly structure.

If compatible with the current project, prefer something similar to:

```text
apps/mobile
├── src
│   ├── api
│   ├── auth
│   ├── components
│   ├── navigation
│   ├── screens
│   ├── storage
│   ├── types
│   └── utils
├── app.json / app.config.*
├── package.json
└── tsconfig.json
```

Do not create excessive abstraction.

Avoid:

- huge generic framework
- unnecessary design patterns
- premature dependency injection
- Redux unless already present
- complex state-management architecture

Keep it understandable for a beginner.

---

# 4. Backend API Configuration

Do NOT hardcode the backend URL throughout the application.

Create a centralized API configuration.

Example concept:

```text
API_BASE_URL
```

Development value should be configurable through environment/configuration.

Support the difference between:

```text
Android emulator
iOS simulator
physical device
local development machine
```

Do not assume:

```text
localhost
```

works from every mobile environment.

Document the expected local-development configuration.

---

# 5. HTTP Client

Create a centralized HTTP client.

If using React Native, Axios or the existing project's HTTP client is acceptable.

The client should support:

```text
GET
POST
PUT
PATCH
DELETE
```

only as needed by current APIs.

At minimum implement:

```text
GET
POST
```

Configure:

- base URL
- JSON content type
- timeout
- authorization header

Do not create separate HTTP logic in every screen.

---

# 6. Authentication API

Integrate with the existing backend Auth APIs.

First inspect the actual backend endpoints and DTOs.

Do NOT invent endpoint names if the backend already defines them.

Support:

```text
Register
Login
Current user (/me)
```

Reuse the exact request/response structure from the backend.

Do not duplicate authentication logic locally.

---

# 7. Token Handling

After successful login:

```text
access token
```

must be stored securely.

For React Native/Expo, prefer a secure storage mechanism such as:

```text
expo-secure-store
```

if compatible with the existing project.

Do NOT store JWT in:

```text
AsyncStorage
plain text files
global variables
logs
```

unless the platform/framework constraints explicitly require another secure mechanism.

Never log JWT values.

---

# 8. Authenticated HTTP Requests

The HTTP client should automatically attach:

```http
Authorization: Bearer <token>
```

for authenticated requests.

Do not manually add the token in every screen.

Centralize this behavior in the HTTP client/interceptor layer.

---

# 9. Authentication State

Create a simple authentication state.

It should represent:

```text
loading
authenticated
unauthenticated
```

and current user information.

For example:

```text
AuthState
├── loading
├── authenticated
└── unauthenticated
```

On application startup:

1. Read stored token.
2. If no token:
   - unauthenticated.
3. If token exists:
   - call `/me`.
4. If `/me` succeeds:
   - authenticated.
5. If token is invalid/expired:
   - clear token.
   - unauthenticated.

Do not assume that having a token means the session is valid.

---

# 10. Auth Context / State Provider

If the mobile stack is React-based, use a simple context/provider or the existing state mechanism.

Example conceptual API:

```text
login()
register()
logout()
refreshUser()
```

Keep this small.

Do not introduce Redux/Zustand/etc. solely for this milestone if the existing project does not already use one.

---

# 11. Navigation

Implement basic navigation based on authentication state.

Conceptually:

```text
App
├── Auth Stack
│   ├── Login
│   └── Register
│
└── Main Stack
    └── Home
```

Unauthenticated:

```text
Login
Register
```

Authenticated:

```text
Home
```

The user must not be able to navigate into authenticated screens without authentication.

Do not implement the full app tab/navigation structure yet.

---

# 12. Login Screen

Create a simple Login screen.

Fields:

```text
Email/Username
Password
```

Use the actual backend login DTO.

UI requirements:

- clean
- simple
- mobile-friendly
- accessible labels
- loading state
- validation errors
- backend error handling
- login button disabled while submitting

After successful login:

```text
save token
→ load current user
→ authenticated state
→ navigate to Home
```

Do not log credentials.

---

# 13. Register Screen

Create a simple Register screen.

Use the actual backend registration DTO.

Do not invent fields.

At minimum handle:

- required fields
- invalid values
- duplicate user
- backend validation errors
- loading state

After successful registration, follow the backend's actual contract.

If registration returns a token, establish authenticated state.

If registration requires login afterward, navigate to login.

Do not assume the behavior; inspect the existing backend implementation.

---

# 14. Home Screen

Create a minimal authenticated Home screen.

Example:

```text
Welcome, {displayName}
```

Include:

```text
Logout
```

This screen is only a foundation.

Do NOT implement:

- map
- nearby users
- friend list
- chat list
- notifications
- profile
- settings

Those will be separate milestones.

---

# 15. Logout

Implement:

```text
logout()
```

Behavior:

1. Clear secure token.
2. Clear current user/auth state.
3. Navigate to Login.
4. Prevent authenticated API calls from using the old token.

Do not simply navigate to Login while keeping the JWT stored.

---

# 16. API Error Handling

Create a simple normalized API error model.

Handle at minimum:

```text
400
401
403
404
409
422
500
network error
timeout
```

Use the backend's actual error response format when available.

Do not expose raw server stack traces to users.

Display user-friendly messages.

Keep the original error available for debugging without logging sensitive information.

---

# 17. Loading States

Implement loading states for:

```text
App startup
Login
Register
Logout if necessary
Current user loading
```

Do not allow duplicate login/register submissions while a request is in progress.

---

# 18. Secure Logging

IMPORTANT:

Never log:

```text
password
JWT
Authorization header
refresh token
password hash
```

Avoid logging complete API responses when they may contain sensitive data.

Development logging may include:

```text
HTTP method
endpoint path
HTTP status
request duration
```

but not credentials/tokens.

---

# 19. TypeScript Types

Create types matching backend DTOs.

At minimum:

```text
LoginRequest
LoginResponse
RegisterRequest
User
ApiError
```

Use actual backend response structures.

Do not use:

```text
any
```

for API models unless there is a justified exception.

Avoid duplicating the same type in multiple files.

---

# 20. API Layer

Do not call HTTP APIs directly from UI components.

Prefer:

```text
Screen
  ↓
Auth service / API service
  ↓
HTTP client
  ↓
Backend
```

For example:

```text
authApi.login()
authApi.register()
authApi.getMe()
```

The exact naming can follow the existing project conventions.

Keep the API layer simple.

---

# 21. Environment Configuration

Provide a documented development configuration.

For example:

```text
EXPO_PUBLIC_API_BASE_URL
```

if Expo is being used.

Do NOT commit:

- production secrets
- JWT secrets
- database credentials
- private API keys

The mobile app's backend URL is configuration, not a secret.

---

# 22. Backend Compatibility

Use the backend implementation from previous milestones as the source of truth.

Before writing mobile API calls:

1. Inspect Auth controller.
2. Inspect Auth DTOs.
3. Inspect User DTOs.
4. Confirm actual endpoint paths.
5. Confirm actual status codes.
6. Confirm error response structure.

Do not modify backend APIs merely to make mobile code easier.

If an incompatibility is found, report it clearly.

Only make minimal backend changes if absolutely necessary.

---

# 23. Testing

Add mobile tests where the existing mobile stack supports them.

At minimum verify:

### Auth state

- initial state is loading
- no token → unauthenticated
- valid token → authenticated
- invalid token → token cleared + unauthenticated

### Login

- successful login
- invalid credentials
- network failure
- loading state
- duplicate submission prevented

### Register

- successful registration
- validation error
- duplicate account
- network failure

### Logout

- token removed
- user state cleared
- navigation returns to login

### API

- Authorization header is attached when authenticated
- no Authorization header when unauthenticated
- 401 handling clears invalid session appropriately

If the project does not yet have a mobile test framework, do not spend the entire milestone building a large testing system.

Add practical tests appropriate to the current stack and document any limitation.

---

# 24. Typecheck / Build

Run the existing mobile validation commands.

At minimum:

```powershell
cd "D:\project\GeoChat\apps\mobile"

npx tsc --noEmit
```

If the project has an existing build command, run it as well.

Example:

```powershell
npm run build
```

Only use commands that actually exist in the current mobile project.

Do not modify scripts merely to manufacture a passing result.

---

# 25. Manual Verification

Run the backend first.

Then start the mobile application.

Verify:

### New user

1. Open app.
2. Register a new account.
3. Verify successful registration behavior.
4. Login if required.
5. Verify Home screen appears.

### Existing user

1. Logout.
2. Login again.
3. Verify Home screen appears.
4. Close/restart the app.
5. Verify authentication state is restored using secure token storage.

### Invalid session

1. Make the stored JWT invalid/expired using a safe test method.
2. Restart app.
3. `/me` should fail.
4. Token should be cleared.
5. User should return to Login.

### Logout

1. Login.
2. Tap Logout.
3. Verify token is removed.
4. Verify Login screen appears.
5. Restart app.
6. Verify user remains logged out.

---

# 26. UI Scope

Keep the UI intentionally simple.

Do NOT spend time on:

- advanced animations
- custom design system
- dark mode
- localization
- complex forms
- map
- chat UI
- notification UI
- friend UI
- profile UI

The objective is technical integration, not visual polish.

---

# 27. Dependency Discipline

Before adding a dependency:

1. Check whether an existing dependency already solves the problem.
2. Prefer platform/Expo-supported solutions.
3. Add only what is necessary.

Do not add:

- Redux
- MobX
- Zustand
- React Query
- Apollo
- Firebase
- analytics SDK
- push notification SDK

unless already present and required by the existing project.

---

# 28. Scope Protection

DO NOT implement:

- Nearby UI
- Friend UI
- User search UI
- Chat UI
- WebSocket client
- Notification UI
- Push notification
- Profile editing
- Settings
- Map
- Location permission
- Background location
- Contacts
- Deep linking
- Offline-first architecture

WebSocket mobile integration will be handled in a separate milestone after the basic mobile foundation is stable.

---

# 29. Regression

PROMPT_012 must not modify backend behavior unnecessarily.

Backend existing tests must continue passing.

If backend files are modified, run:

```powershell
cd "D:\project\GeoChat\backend"

.\mvnw.cmd test
```

Also run the mobile typecheck.

---

# 30. Final Validation

Run the appropriate commands:

```powershell
cd "D:\project\GeoChat\apps\mobile"

npx tsc --noEmit
```

and the project's existing mobile build/test commands.

If backend changes were made:

```powershell
cd "D:\project\GeoChat\backend"

.\mvnw.cmd test
.\mvnw.cmd -DskipTests compile
```

All relevant commands must pass.

---

# 31. Final Report

At the end, report:

## Existing Mobile Stack

State:

```text
Framework:
Package manager:
Navigation:
State management:
```

Do not change these simply for preference.

## Changed

List files/modules created or modified.

## API Integration

Document:

```text
API base URL configuration
HTTP client
Auth API
/me API
```

## Authentication

Explain:

```text
login
register
token storage
session restoration
logout
```

## Navigation

Document:

```text
Auth Stack
Main/Home
```

## Security

Explain:

- secure token storage
- JWT handling
- no credential logging
- unauthorized session handling

## Tests

Report:

```text
Typecheck:
PASS / FAIL

Tests:
PASS / FAIL

Build:
PASS / FAIL
```

Use only commands that actually exist.

## Manual Verification

Report:

```text
Register:
PASS / FAIL

Login:
PASS / FAIL

Session restore:
PASS / FAIL

Invalid session:
PASS / FAIL

Logout:
PASS / FAIL
```

## Backend Regression

If backend was touched:

```text
Backend tests:
PASS / FAIL
```

## Issues

List remaining issues or assumptions.

## Completion Status

Only report:

```text
PROMPT_012 COMPLETE
```

if ALL requirements above are implemented and verified.

Otherwise report:

```text
PROMPT_012 NOT COMPLETE
```

and clearly list what remains.

Do not upgrade/downgrade project versions.
Do not replace the existing mobile framework.
Do not modify unrelated backend modules.