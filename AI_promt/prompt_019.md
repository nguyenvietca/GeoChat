# PROMPT_019 — Web Foundation, Authentication, User Search & Nearby Users

## Context

GeoChat is a monorepo with:

- `backend`
- `web`
- `mobile`
- `packages`
- `database`
- `docs`

The backend already provides:

- Java 21
- Spring Boot 4.1.0
- Maven Wrapper
- PostgreSQL
- PostGIS
- Flyway
- JWT
- Modular monolith architecture

The mobile application already has:

- Authentication
- User search
- Nearby users
- Friends
- Direct chat
- Realtime WebSocket chat
- In-app notifications
- Push notifications
- Profile / Settings

The next phase is to bring the core user-discovery experience to Web.

---

# Goal

Implement the Web foundation and the first core user features.

This milestone must provide:

1. Web application foundation
2. Environment configuration
3. Central API client
4. Authentication state
5. Login
6. Register
7. Current-user restoration
8. Logout
9. Protected routes
10. Authenticated Home
11. User Search
12. Nearby Users
13. Browser/device location permission for Nearby
14. Location synchronization with backend
15. Responsive UI
16. Proper loading/error/empty states

Do NOT implement Web Friends, Web Chat, Web Notifications, or Web Profile yet.

---

# 1. Inspect Before Coding

Before changing anything, inspect the existing `web` project.

Determine:

- frontend framework
- React version
- TypeScript version
- Vite configuration
- router
- styling solution
- component structure
- shared packages
- environment configuration
- API utilities
- authentication implementation
- existing UI components

Also inspect the existing backend APIs for:

- authentication
- current user
- user search
- current location
- nearby users

Do not guess API contracts.

Do not replace an existing working frontend stack.

If the project already uses React + TypeScript + Vite, keep it.

---

# 2. Fixed Technology Constraints

Keep the existing Web stack.

Expected baseline:

- React
- TypeScript
- Vite

Backend:

- Java 21
- Spring Boot 4.1.0
- PostgreSQL
- PostGIS
- JWT

Do NOT use Supabase.

Do NOT introduce a large frontend framework or state-management library unless the existing project already requires it.

Prefer simple, maintainable architecture suitable for a beginner-friendly vibe-code project.

---

# 3. Environment Configuration

Use the existing Vite environment mechanism.

Example:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Use the actual backend URL discovered from the project.

Requirements:

- no hardcoded backend URL inside components
- provide `.env.example`
- no secrets committed
- centralized API configuration

---

# 4. Central API Client

Create or improve a centralized HTTP client.

For example:

```text
web/src/api/
```

Follow the actual project structure.

The API layer should centralize:

- base URL
- JSON headers
- JWT authentication
- response parsing
- common error handling

Do not make raw HTTP requests directly inside UI components.

Create typed API functions for:

- authentication
- current user
- user search
- location
- nearby users

Use the actual backend contracts.

---

# 5. Authentication

Implement centralized authentication state.

It should support:

```text
loading
authenticated
unauthenticated
```

Expose the current user.

Conceptually:

```text
AuthProvider
 ├── user
 ├── loading
 ├── isAuthenticated
 ├── login()
 ├── register()
 ├── logout()
 └── refreshUser()
```

Adapt to the existing architecture.

Do not introduce Redux/Zustand unless already present.

---

# 6. Login

Create a Login page.

Requirements:

- actual backend login fields
- password field
- validation
- loading state
- backend error handling
- link to Register

Flow:

```text
Login
 ↓
backend authentication
 ↓
store JWT/auth state
 ↓
load current user
 ↓
Home
```

Do not invent authentication behavior.

---

# 7. Register

Create a Register page using the actual backend registration DTO.

Requirements:

- required field validation
- loading state
- backend validation errors
- duplicate-user handling
- link to Login

After registration, follow the actual backend behavior.

Do not assume registration automatically logs the user in.

---

# 8. Current User Restoration

When the browser starts:

```text
stored authentication
        ↓
GET current user
        ↓
authenticated
```

If authentication is invalid:

```text
clear authentication
        ↓
Login
```

Handle loading correctly.

Do not display protected pages before authentication initialization completes.

---

# 9. Protected Routes

Implement protected routing.

Example:

```text
/login
/register

/app
/app/home
/app/search
/app/nearby
```

Unauthenticated users attempting to access `/app/*` must be redirected to Login.

Authenticated users attempting to access `/login` or `/register` should be redirected to Home.

Avoid redirect loops.

---

# 10. Web Application Shell

Create a reusable authenticated application shell.

Example:

```text
┌────────────────────────────────────┐
│ GeoChat                 User Logout │
├────────────┬───────────────────────┤
│ Home       │                       │
│ Search     │       Page Content    │
│ Nearby     │                       │
│            │                       │
└────────────┴───────────────────────┘
```

At this milestone, only these sections need to be functional:

- Home
- Search
- Nearby

Do not implement Friends/Chat/Notifications yet.

---

# 11. Home Page

Create a basic authenticated Home page.

Display:

- GeoChat
- current user's display name/username
- basic public user information
- welcome message
- navigation to Search and Nearby

Do not expose private backend fields.

---

# 12. User Search

Implement:

```text
/app/search
```

Use the existing backend user-search API.

The UI should provide:

- search input
- search button or controlled search
- loading state
- empty state
- error state
- result list
- pagination/load-more if supported by the backend

Search should not execute unnecessary requests for every keystroke.

Use a sensible approach such as:

- submit button
- debounce

based on the existing UX architecture.

---

# 13. User Search Result

Display only information returned as public by the backend.

Typical information may include:

- avatar if already supported
- username
- display name

Do NOT display:

- password
- JWT
- email unless the backend explicitly treats it as public
- raw location
- private fields

Exclude the currently authenticated user if the backend contract already does so.

Do not duplicate relationship/friend logic in this milestone.

---

# 14. Nearby Users

Implement:

```text
/app/nearby
```

The feature should:

1. request browser/device location permission
2. obtain current latitude/longitude
3. synchronize current location with backend
4. request nearby users from backend
5. display nearby users

Use the existing backend location APIs.

Do NOT implement location tracking in the background.

Do NOT implement a map yet.

---

# 15. Browser Location Permission

Use the browser Geolocation API unless the existing Web project already has an appropriate location abstraction.

Handle:

- permission granted
- permission denied
- location unavailable
- timeout
- browser does not support geolocation

Example user-facing state:

```text
Location permission is required to find nearby users.
```

Do not continuously track the user's location.

Only request location when the user enters/uses Nearby.

---

# 16. Location Synchronization

Use the existing authenticated location endpoint.

Conceptually:

```text
Browser location
      ↓
POST current location
      ↓
GET nearby users
```

Do not send location continuously.

Do not expose the user's exact coordinates in the UI.

Do not store browser location unnecessarily in frontend persistent storage.

---

# 17. Nearby Search

Use the existing backend nearby-search API.

Respect the backend's:

- default radius
- maximum radius
- distance calculation
- privacy rules

If the API supports a radius parameter, provide a simple UI control only if this can be implemented cleanly.

Otherwise use the backend default radius.

Do not duplicate PostGIS distance calculations in the browser.

The backend remains the source of truth.

---

# 18. Nearby User Result

Display safe public information such as:

- username
- display name
- avatar if available
- approximate distance if the backend already returns it

Do NOT display:

- latitude
- longitude
- database IDs unless required by UI interactions
- private fields

If distance is returned by the backend, format it clearly:

```text
250 m away
```

or:

```text
2.4 km away
```

Do not recalculate distance in the frontend.

---

# 19. Search + Nearby UX

Both features must support:

### Loading

Show a clear loading state.

### Empty

Example:

```text
No users found.
```

or:

```text
No nearby users found.
```

### Error

Show a user-friendly error.

### Retry

Provide retry where appropriate.

### Authentication

Unauthorized API responses should return the user to Login through the centralized auth handling.

---

# 20. Responsive Design

The Web application must work on:

- desktop
- laptop
- tablet
- smaller browser widths

Do not create separate mobile/desktop implementations.

Use responsive layout.

Keep UI simple.

Prioritize usability over visual complexity.

---

# 21. TypeScript Types

Create typed models for APIs used by this milestone.

At minimum, adapt to actual backend DTOs for:

```text
User
LoginRequest
LoginResponse
RegisterRequest
RegisterResponse
Location
NearbyUser
UserSearchResult
```

Do not blindly create fields that do not exist.

Avoid `any`.

Reuse shared types if the repository already provides them.

---

# 22. Logout

Implement logout.

Required:

1. clear authentication
2. clear current-user state
3. clean up any frontend resources created by this milestone
4. navigate to Login

Logout must still succeed if a cleanup request fails.

Do not implement WebSocket cleanup yet unless WebSocket is already initialized by existing code.

---

# 23. Security

Verify:

- JWT is attached centrally to authenticated API requests
- no password is stored
- JWT is never displayed
- no secrets are committed
- private user fields are not rendered
- location coordinates are not exposed in UI
- authenticated APIs require authentication
- expired/invalid authentication is handled centrally

Do not trust client-side authentication alone.

Backend remains responsible for authorization.

---

# 24. Tests

Inspect the existing Web testing setup.

Add tests for important behavior.

### Authentication

- login success
- login failure
- register validation
- auth restoration
- logout
- protected route

### User Search

- search success
- empty result
- API error
- loading state

### Nearby

- permission granted
- permission denied
- location unavailable
- nearby search success
- empty nearby result
- API error

Do not introduce a large testing framework solely for this milestone.

---

# 25. Validation

Run the existing project commands.

At minimum:

```bash
cd web
npm install
npm run build
```

Also run available:

```bash
npm run test
npm run lint
npm run typecheck
```

Only run commands that actually exist in the project.

Fix all errors introduced by this milestone.

---

# 26. Manual Verification

Verify the following flow:

### Scenario A — Login

```text
Login
 ↓
Home
 ↓
Current user displayed
```

### Scenario B — Refresh

```text
Authenticated Home
 ↓
Browser refresh
 ↓
Authentication restored
 ↓
Home remains accessible
```

### Scenario C — Search

```text
Home
 ↓
Search
 ↓
enter user query
 ↓
search results displayed
```

### Scenario D — Nearby

```text
Home
 ↓
Nearby
 ↓
request location permission
 ↓
location synchronized
 ↓
nearby users displayed
```

### Scenario E — Location denied

```text
Nearby
 ↓
deny permission
 ↓
friendly error/instruction
 ↓
application remains usable
```

### Scenario F — Logout

```text
Home
 ↓
Logout
 ↓
Login
 ↓
/app is protected
```

---

# 27. Regression

After implementation verify:

- backend still starts
- mobile project is unaffected
- shared packages still build if applicable
- existing repository structure is preserved
- no unrelated backend behavior changes
- existing API contracts are not broken

Do not refactor unrelated code.

---

# 28. Scope Protection

DO NOT implement:

- Web Friends
- friend requests
- Web Chat
- WebSocket client
- Web Notifications
- Web Push Notifications
- Web Profile editing
- Web Settings
- Map
- background location
- location history
- group chat
- media upload
- file upload
- calls
- social login
- OAuth
- password reset
- 2FA
- admin dashboard
- complex design system
- Redux/Zustand migration

These belong to later milestones.

---

# 29. Completion Criteria

PROMPT_019 is complete only when:

- [ ] Web stack inspected and preserved
- [ ] Environment configuration works
- [ ] Central API client implemented
- [ ] Authentication state implemented
- [ ] Login works
- [ ] Register works
- [ ] Current-user restoration works
- [ ] Protected routes work
- [ ] Logout works
- [ ] Authenticated Home works
- [ ] User Search works
- [ ] Nearby Users works
- [ ] Browser location permission handled
- [ ] Current location synchronized with backend
- [ ] Nearby results displayed safely
- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] Error states implemented
- [ ] Responsive layout implemented
- [ ] Tests added/updated where applicable
- [ ] TypeScript validation passes
- [ ] Web build passes
- [ ] Existing functionality has no regression

---

# Final Report

Report:

```text
PROMPT_019 COMPLETE
```

only if all applicable completion criteria are satisfied.

Otherwise:

```text
PROMPT_019 NOT COMPLETE
```

Then report:

1. What was implemented
2. Files changed
3. Pages/routes added
4. API endpoints integrated
5. Authentication approach
6. Location implementation
7. Tests executed
8. Build/typecheck results
9. Manual verification
10. Known limitations
11. Remaining work

Do not silently expand the scope.
