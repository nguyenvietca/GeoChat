# PROMPT_022 — Web Profile & Settings

## Context

GeoChat is a web + mobile application.

The web application already has:

- Authentication
- Protected routes
- User Search
- Nearby Users
- Friends
- Direct Chat
- WebSocket/STOMP realtime messaging
- Notifications
- JWT authentication
- Centralized API client
- TypeScript API models
- Existing authenticated user state

PROMPT_019 established the Web foundation, authentication, search, and nearby users.

PROMPT_020 established Web Friends, Direct Chat, and realtime messaging.

PROMPT_021 established Web Notifications and realtime notification handling.

Now implement the **Web Profile & Settings** experience.

---

# Goal

Add a clean and beginner-friendly Profile and Settings area to the existing web application.

The implementation must reuse the existing authentication/user infrastructure and the actual backend APIs.

Do NOT invent backend endpoints.

---

# 1. Inspect Before Coding

Before modifying code:

1. Inspect the current web application structure.
2. Inspect the existing routing/navigation.
3. Inspect the current authentication state/provider/store.
4. Inspect the existing API client.
5. Inspect TypeScript API models.
6. Inspect the actual backend user/auth APIs.
7. Inspect the current authenticated-user `/me` implementation.
8. Check whether backend already supports:
   - profile update
   - password change
   - username/display name update
   - avatar/profile image
9. Inspect existing logout implementation.
10. Inspect existing WebSocket cleanup logic from PROMPT_020/021.
11. Reuse existing UI components/styles if available.

**Important:**

Do not create frontend calls to APIs that do not exist in the backend.

If a feature is not supported by the backend, do not fake it with local state.

---

# 2. Fixed Technology Constraints

Keep the existing web stack.

Do NOT replace the current framework.

Do NOT introduce a large state-management framework just for this feature.

Use:

- existing React/web framework
- existing TypeScript setup
- existing router
- existing API client
- existing authentication mechanism
- existing styling/UI system

Only add a dependency when it is genuinely necessary.

---

# 3. Profile Page

Create a Profile page/route using the existing routing conventions.

Example:

`/app/profile`

The page should display the authenticated user's available public/profile information.

At minimum, display fields that actually exist in the backend, such as:

- username
- display name
- email, only if appropriate according to the existing backend/privacy model
- avatar, only if already supported

Do not expose:

- password
- password hash
- JWT
- internal security fields
- private database fields

Use the existing `/me` or equivalent authenticated-user API.

Do not duplicate user data unnecessarily.

---

# 4. Edit Profile

If the backend already supports profile updates, implement an Edit Profile flow.

Possible fields:

- display name
- username
- avatar/profile image, only if backend already supports it

Use the actual backend DTO and validation rules.

The frontend must:

1. Load current profile.
2. Populate the form.
3. Allow editing supported fields.
4. Validate user input.
5. Submit through the centralized API layer.
6. Display success/error state.
7. Refresh/update the authenticated user state after success.

Do not manually modify unrelated user state.

---

# 5. Password Change

First inspect whether the backend already provides a password-change API.

### If supported

Add a password change section in Settings.

Example fields:

- current password
- new password
- confirm new password

Requirements:

- client-side validation
- clear validation messages
- never log passwords
- never store passwords in localStorage/sessionStorage
- submit through the centralized API client
- handle authentication/validation errors correctly
- clear form after successful change

### If not supported

Do NOT implement a fake password-change feature.

Simply omit the feature from the UI.

---

# 6. Settings Page

Create a Settings page/route.

Example:

`/app/settings`

Keep this page intentionally simple.

Only include settings that are already supported by the application.

Possible sections:

### Account

- profile
- password change, if supported

### Session

- Logout

Do not invent advanced settings.

Do not add:

- 2FA
- account deletion
- password reset
- social login
- notification preferences
- privacy settings
- push notification settings
- language settings
- theme system

unless they already exist in the project.

---

# 7. Logout

Reuse the existing authentication logout mechanism.

When the user logs out:

1. Clear authentication state.
2. Remove the stored access token using the existing mechanism.
3. Clear user state.
4. Disconnect/cleanup WebSocket connections.
5. Clear notification realtime subscriptions.
6. Clear any relevant transient application state.
7. Navigate to Login.

Logout must not leave an authenticated WebSocket connection alive.

Logout must not require a full browser refresh.

---

# 8. Navigation

Integrate Profile and Settings into the existing authenticated navigation.

Possible navigation:

- Home
- Search
- Nearby
- Friends
- Chat
- Notifications
- Profile
- Settings

Follow the existing navigation design rather than creating a second navigation system.

If the existing navigation is responsive, preserve that behavior.

---

# 9. Authenticated User State

After profile update:

- update the existing authenticated-user state
- ensure navigation/header/avatar/profile information reflects the new data
- avoid requiring a browser refresh

If the application currently relies on `/me` for restoring the session, continue using that mechanism.

Do not introduce duplicate authentication state.

---

# 10. API Layer

All backend calls must go through the existing centralized API layer.

Do NOT make raw `fetch()`/Axios calls directly from components if the project already has an API abstraction.

Add/update API functions only where required.

Examples conceptually:

```text
getCurrentUser()
updateProfile(...)
changePassword(...)
```

Only implement functions corresponding to actual backend endpoints.

Keep TypeScript request/response types aligned with backend DTOs.

---

# 11. Loading States

Implement proper loading behavior.

Examples:

- Profile loading
- Profile update submitting
- Password change submitting

Prevent duplicate submissions while an operation is in progress.

Use the existing loading UI pattern where possible.

---

# 12. Error Handling

Handle at least:

- authentication failure
- validation failure
- duplicate username, if applicable
- backend validation errors
- network failure
- unexpected server error

Do not expose raw backend stack traces to users.

Display understandable messages.

Do not swallow errors silently.

---

# 13. Success Feedback

After successful profile update:

- show a clear success message
- update displayed user information
- keep the user on the appropriate page

After successful password change:

- show a success message
- clear password fields

Do not automatically log the user out unless the backend explicitly requires it.

---

# 14. Empty / Unsupported Data

Handle optional fields safely.

For example:

- missing avatar
- missing display name
- optional profile information

Do not render broken images or undefined values.

Use a simple placeholder when appropriate.

---

# 15. Responsive UI

The Profile and Settings pages must work on:

- desktop
- tablet
- mobile-width browser

Reuse the existing responsive layout.

Do not redesign the entire application.

---

# 16. Security

Verify that:

- only authenticated users can access Profile/Settings
- unauthenticated users are redirected to Login
- sensitive fields are never rendered
- passwords are never logged
- JWT is never displayed
- API errors do not leak sensitive backend details
- profile update uses the authenticated user's authorization
- logout properly terminates client-side realtime connections

Do not trust frontend authorization as a security boundary.

Backend authorization remains authoritative.

---

# 17. Tests

Add/update tests appropriate to the existing test setup.

At minimum cover:

### Profile

- authenticated user can load profile
- profile data is rendered
- profile update success
- profile update validation/error

### Password

If password change exists:

- valid password change
- validation failure
- backend rejection

### Authentication

- unauthenticated user cannot access Profile
- unauthenticated user cannot access Settings
- logout clears authentication state

### WebSocket cleanup

Verify logout performs the existing WebSocket/realtime cleanup.

Do not create a completely new testing framework.

---

# 18. Manual Verification

Run the application and verify with a real backend.

### Account A

1. Login.
2. Open Profile.
3. Verify current user information.
4. Edit supported profile fields.
5. Save.
6. Verify updated information appears immediately.
7. Open Settings.
8. Verify available settings.
9. Logout.
10. Verify redirect to Login.
11. Verify authenticated pages are no longer accessible.

### Account B

Verify Account B sees the updated public user information where applicable.

If password change exists:

1. Change password.
2. Verify success.
3. Verify the old password is rejected.
4. Verify the new password works.

---

# 19. Build Validation

Run the existing project validation commands.

At minimum:

```bash
npm run build
```

Also run the existing test/typecheck commands if they are configured.

Fix all TypeScript/build/test errors introduced by this prompt.

Do not leave unrelated broken code unresolved unless it existed before this prompt.

---

# 20. Regression Check

Confirm that these existing features still work:

- Login
- Register
- Logout
- Home
- User Search
- Nearby Users
- Friends
- Direct Chat
- WebSocket messaging
- Notifications
- Notification realtime updates

Profile/Settings implementation must not break existing authentication or realtime behavior.

---

# 21. Scope Protection

This prompt is ONLY for:

- Web Profile
- Edit Profile
- Web Settings
- Password Change if backend supports it
- Logout integration
- Navigation integration
- Tests
- Build/typecheck validation

Do NOT implement:

- Group Chat
- Media messages
- File upload infrastructure
- Browser Push Notifications
- Notification preferences
- Account deletion
- 2FA
- Password reset
- Social login
- Advanced privacy controls
- Map UI
- Background location
- New backend modules
- New authentication architecture
- New state-management architecture
- Major UI redesign

If a required backend API does not exist, do not create an unrelated backend feature just to satisfy the frontend.

---

# 22. Final Report

When finished, report:

1. Files changed.
2. Routes added.
3. Backend APIs actually used.
4. Profile fields supported.
5. Whether password change is supported by the backend.
6. Logout/WebSocket cleanup behavior.
7. Tests added/updated.
8. Build/typecheck result.
9. Any known limitations.

At the very end, use exactly one of:

```text
PROMPT_022 COMPLETE
```

or

```text
PROMPT_022 NOT COMPLETE
```

Only report `PROMPT_022 COMPLETE` when all applicable requirements have been implemented, tested, and validated.