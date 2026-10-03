# PROMPT 013 — Mobile Home, User Search & Nearby Users

## Context

GeoChat is a beginner-friendly but technically grounded mobile + web application.

The backend already provides:

- Authentication / JWT
- User management
- Current user location
- Nearby user search using PostGIS
- User discovery/search
- Friend foundation
- Direct chat foundation
- WebSocket chat
- Notification foundation

The mobile app foundation and backend authentication integration were implemented in PROMPT 012.

Relevant backend capabilities already implemented:

- User search:
  - `GET /api/v1/users/search`
- Current authenticated user's location:
  - `POST /api/v1/locations/me`
  - `GET /api/v1/locations/me`
- Nearby users:
  - `GET /api/v1/locations/nearby`

Do NOT assume the exact request/response DTO field names. Inspect the existing backend implementation first and integrate with the actual API contract.

---

# Goal

Implement the first useful authenticated mobile experience:

1. Authenticated Home screen
2. User Search screen
3. Nearby Users screen
4. Foreground device location permission and location synchronization for Nearby Users
5. Navigation between these screens
6. Proper loading, empty, error, and permission states

The mobile app should now allow a logged-in user to:

- see a simple Home screen
- search for other users
- open Nearby Users
- grant foreground location permission
- synchronize the device's current location with the backend
- retrieve nearby users
- see public user information and distance
- refresh nearby results

Keep the implementation simple and beginner-friendly.

---

# IMPORTANT — Inspect Before Coding

Before modifying code:

1. Inspect the current mobile project structure.
2. Inspect the mobile implementation from PROMPT 012.
3. Identify:
   - framework
   - navigation library
   - API client
   - auth state/provider
   - secure token storage
   - environment configuration
   - existing screen/component conventions
4. Inspect the backend implementation for:
   - `/api/v1/users/search`
   - `/api/v1/locations/me`
   - `/api/v1/locations/nearby`
5. Read the actual DTOs, validation rules, response fields, authentication requirements, and error responses.

Do NOT invent API contracts when the backend already defines them.

Reuse the existing architecture from PROMPT 012 instead of introducing another API client, auth mechanism, navigation system, or state-management library.

---

# Fixed Technology Constraints

Keep the existing project stack.

Expected stack:

- React Native
- Expo
- TypeScript

If the existing mobile implementation uses these technologies, keep them.

Do NOT migrate the mobile framework.

Do NOT introduce a large state-management framework for this milestone.

Do NOT introduce Redux, Zustand, MobX, TanStack Query, or another major dependency unless the existing project already uses it.

Use the existing API/auth abstractions created in PROMPT 012.

---

# 1. Authenticated Home Screen

Create or improve the authenticated Home screen.

The Home screen should provide:

- current user's basic information if already available from `/me`
- simple welcome message
- navigation to:
  - User Search
  - Nearby Users
- logout action using the existing auth implementation

Keep the UI intentionally simple.

Example conceptual layout:

```text
GeoChat

Hello, <display name>

[ Search Users ]

[ Nearby Users ]

[ Logout ]
```

Use the actual user fields available from the existing `/me` response.

Do not display private user information unnecessarily.

---

# 2. Navigation

Integrate the new screens into the existing authenticated navigation.

Required screens:

- Home
- User Search
- Nearby Users

Reuse the existing navigation architecture from PROMPT 012.

If the current project uses:

- Stack navigation → continue using it.
- Tab navigation → integrate the screens into the existing tabs where appropriate.

Do not replace the navigation library.

Unauthenticated users must still be redirected to the existing Login/Register flow.

Authenticated users must not be able to access the authenticated screens without a valid auth state.

---

# 3. User Search Screen

Implement:

```text
UserSearchScreen
```

The screen should contain:

- search input
- search action
- loading state
- result list
- empty state
- error state

Use the existing backend API:

```http
GET /api/v1/users/search?q={query}
```

If the backend supports pagination parameters such as `limit` and `offset`, use them according to the actual API contract.

Do not invent different query parameter names.

---

## Search Behavior

Minimum behavior:

1. User enters a search term.
2. User submits the search.
3. Mobile calls the backend API.
4. Display matching users.
5. Exclude the current user if the backend already guarantees this.
6. Handle empty results.
7. Handle API errors.

Avoid making unnecessary API requests for an empty query.

Trim whitespace before submitting.

Use the backend's actual validation rules for minimum/maximum query length.

---

# 4. Search Result UI

Display only public fields returned by the backend.

For example, if available:

```text
Display Name
@username
```

Do NOT assume these fields exist.

Inspect the actual DTO and use its real fields.

Do NOT display:

- password
- password hash
- JWT
- private/internal IDs unless actually needed
- email unless the backend explicitly exposes it as a public field
- location coordinates
- other sensitive/internal fields

For this milestone, tapping a search result does not need to open a profile.

Do NOT implement Friend Request UI yet.

Do NOT implement Chat UI yet.

---

# 5. Nearby Users Screen

Implement:

```text
NearbyUsersScreen
```

The screen should:

1. Explain that location permission is required.
2. Request foreground location permission when the user opens the screen.
3. Obtain the device's current location.
4. Synchronize it with the backend.
5. Call the nearby-users endpoint.
6. Display nearby users.
7. Show distance information.
8. Allow refreshing the result.

Use the backend's actual API contract.

The nearby API is conceptually:

```http
GET /api/v1/locations/nearby?radius=5000
```

Use the actual supported parameters discovered from the backend implementation.

Default radius:

```text
5000 meters
```

Do not implement a complicated radius-selection UI in this milestone.

---

# 6. Foreground Location Permission

Use the location API/library already compatible with the current Expo project.

If Expo Location is already available, use it.

Do NOT add background location tracking.

Do NOT implement continuous location tracking.

Do NOT request location permission globally when the app starts.

Only request foreground location permission when the user accesses Nearby Users.

---

# 7. Location Synchronization

After permission is granted:

1. Get the device's current latitude and longitude.
2. Send them to:

```http
POST /api/v1/locations/me
```

Use the exact request DTO defined by the backend.

Then request:

```http
GET /api/v1/locations/nearby
```

The backend should remain responsible for:

- distance calculation
- radius filtering
- PostGIS logic
- excluding the current user

The mobile app must NOT calculate nearby users itself.

---

# 8. Privacy Requirements

Location data is sensitive.

The mobile UI must NOT display raw latitude/longitude.

Do not log latitude/longitude.

Do not log the full location API request.

Do not expose location coordinates in error messages.

Nearby results should display only information intended by the backend, such as:

```text
John
2.3 km away
```

or the equivalent actual DTO fields.

Do not add a map in this milestone.

Do not add location history.

Do not add background tracking.

---

# 9. Location Permission Denied

If the user denies location permission:

Show a clear message such as:

```text
Location permission is required to find nearby users.
```

Provide an appropriate retry/request-permission action if supported by the platform.

Do NOT call the nearby API when the application has no usable location.

Do NOT crash the application.

Handle permanently denied permission gracefully.

Do not repeatedly request permission in a loop.

---

# 10. Location/API Failure Handling

Handle these cases:

### Permission denied

Show a friendly permission message.

### Device location unavailable

Show an error state and allow retry.

### Current location API fails

Show an error state and allow retry.

### Nearby API fails

Show an error state and allow retry.

### No nearby users

Show an empty state such as:

```text
No nearby users found.
```

Do not treat an empty result as an error.

---

# 11. Nearby User Result UI

Use the actual backend response fields.

Possible conceptual UI:

```text
Nearby Users

[ Refresh ]

Alice
1.2 km away

Bob
3.7 km away

Charlie
4.8 km away
```

Distance should use the distance value returned by the backend.

Do NOT recalculate the distance in the mobile app.

If the backend returns meters, format them into a human-readable representation.

For example:

```text
850 m away
2.4 km away
```

Keep the formatter small and reusable.

---

# 12. API Layer

Do not make HTTP requests directly inside UI components.

Use the API/client architecture created in PROMPT 012.

Prefer a structure similar to:

```text
api/
  authApi.ts
  userApi.ts
  locationApi.ts
```

or the equivalent structure already present in the project.

Create typed methods for:

```text
searchUsers(...)
getMyLocation(...)
updateMyLocation(...)
getNearbyUsers(...)
```

Use the actual API contracts from the backend.

Avoid:

```ts
fetch(...)
```

directly inside screen components if PROMPT 012 already established an API abstraction.

---

# 13. TypeScript Types

Create/reuse TypeScript interfaces/types for:

- User search response
- Current location response
- Update location request
- Nearby user response

Do not use `any` to bypass API typing.

Do not duplicate the same DTO type in multiple screens.

Keep API types separate from UI-specific view models when appropriate.

---

# 14. Loading States

Each async operation should have an explicit loading state.

Examples:

```text
Searching...
Getting your location...
Finding nearby users...
```

Disable duplicate actions while the corresponding operation is running.

Avoid sending duplicate requests because the user taps a button multiple times.

---

# 15. Refresh Behavior

Nearby Users should provide a simple refresh action.

Refreshing should:

1. obtain the current device location if appropriate
2. update the backend current location
3. request nearby users again

Do not create a background polling mechanism.

Do not implement realtime location tracking.

---

# 16. UI/UX Requirements

Keep the design beginner-friendly and consistent with the existing mobile app.

Required states:

### User Search

- initial state
- searching
- results
- no results
- error

### Nearby Users

- initial state
- requesting permission
- obtaining location
- loading nearby users
- results
- no results
- permission denied
- location unavailable
- API error

Do not over-engineer the UI.

No animations are required.

No map is required.

No advanced design system is required.

---

# 17. Tests

Add focused tests where the current mobile project supports testing.

At minimum cover the important behavior:

### User Search

- valid query triggers API request
- empty/invalid query does not make an unnecessary request
- results are rendered
- empty results are handled
- API error is handled

### Nearby Users

- permission granted → location is obtained
- location is synchronized
- nearby API is called
- nearby users are rendered
- empty nearby result is handled
- permission denied is handled
- API failure is handled

### Authentication

Verify that:

- authenticated user can access Home
- unauthenticated user is redirected to Login
- logout returns to unauthenticated flow

Do not add a large testing framework solely for this milestone if the project does not already have one.

Use the existing testing setup.

---

# 18. Validation

Run the appropriate mobile validation commands.

At minimum:

```bash
cd apps/mobile
npx tsc --noEmit
```

If the project has a test command, run it.

Also run the mobile build/check command already established by the project.

If backend code was modified, run the backend tests as well.

Do not claim completion if validation fails.

---

# 19. Manual Verification

Perform a realistic manual verification if the environment allows it.

Test:

### Authentication

1. Open mobile app.
2. Login.
3. Confirm Home appears.
4. Logout.
5. Confirm Login screen appears.

### User Search

1. Login.
2. Open User Search.
3. Search for an existing user.
4. Confirm results appear.
5. Search for a non-existing user.
6. Confirm empty state.
7. Test invalid/empty input.

### Nearby Users

1. Login.
2. Open Nearby Users.
3. Grant foreground location permission.
4. Confirm current location is synchronized.
5. Confirm nearby users are loaded.
6. Confirm distance is displayed.
7. Confirm current user is not displayed as a nearby user.
8. Refresh.
9. Test permission denied behavior if possible.

Do not expose raw coordinates in the UI or logs.

---

# 20. Regression Protection

Do not break the functionality implemented in previous milestones.

Verify that:

- Login still works.
- Register still works.
- `/me` still works.
- Secure token storage still works.
- Logout still works.
- Authenticated navigation still works.
- Existing backend APIs remain unchanged.
- Existing backend tests still pass.

Do not modify backend business logic unless necessary for API compatibility.

If backend changes are necessary, explain exactly why.

---

# 21. Scope Protection

DO NOT implement the following in PROMPT 013:

- Friend request UI
- Friend list UI
- Accept/reject friend UI
- Chat UI
- WebSocket client
- Notification UI
- Push notifications
- Map UI
- Background location
- Location history
- Realtime location tracking
- User profile editing
- Settings screen
- Block/report system
- Advanced search filters
- Complex state management
- New backend modules

Those features belong to later milestones.

---

# 22. Code Quality

Follow the existing project conventions.

Prefer:

- small components
- typed API functions
- reusable loading/error components if already available
- clear naming
- simple navigation
- minimal dependencies
- no duplicated API logic

Do not refactor unrelated code.

Do not rewrite working authentication code from PROMPT 012.

Do not introduce architecture changes just for this milestone.

---

# 23. Final Report

When implementation is complete, report:

### Changed

List:

- screens added/updated
- navigation changes
- API services added/updated
- location permission integration
- TypeScript types
- tests

### Validation

Report the exact commands and results.

Example:

```text
npx tsc --noEmit       PASS
npm test               PASS
```

### Manual Verification

Report what was actually tested.

### Backend Changes

Explicitly state:

```text
Backend changed: YES/NO
```

If YES, explain why.

### Scope Check

Confirm that the following were NOT implemented:

- Friend UI
- Chat UI
- Notification UI
- Map
- Background location
- Realtime location tracking

---

# Completion Rule

Only report:

```text
PROMPT_013 COMPLETE
```

if all required functionality is implemented and validation passes.

Otherwise report:

```text
PROMPT_013 NOT COMPLETE
```

and clearly list:

1. what is incomplete
2. what failed
3. what remains to be fixed

Do not mark the milestone complete just because the app compiles.

# End of PROMPT 013