# PROMPT 017 — Mobile Profile & Settings

## Context

GeoChat is a beginner-friendly but technically grounded mobile + web application.

The following milestones are complete:

- PROMPT 001 — Project Skeleton
- PROMPT 002 — Backend Build Foundation
- PROMPT 003 — PostgreSQL/Flyway Foundation
- PROMPT 004 — User + Authentication
- PROMPT 005 — Current Location
- PROMPT 006 — Nearby Users
- PROMPT 007 — Friend Foundation
- PROMPT 008 — User Discovery & Search
- PROMPT 009 — Direct Chat Backend
- PROMPT 010 — Chat WebSocket Backend
- PROMPT 011 — Notification Backend
- PROMPT 012 — Mobile Authentication/Foundation
- PROMPT 013 — Mobile Home/Search/Nearby Users
- PROMPT 014 — Mobile Friend UI
- PROMPT 015 — Mobile Direct Chat UI & Realtime Messaging
- PROMPT 016 — Mobile Notification UI & Realtime Notifications

The mobile app currently supports:

- Authentication
- Home
- User Search
- Nearby Users
- Friends
- Direct Chat
- Realtime Chat
- Notifications

This milestone adds the user's Profile and basic Settings experience.

---

# Goal

Implement:

1. Profile screen
2. Edit Profile screen
3. Settings screen
4. Logout
5. Basic account-related actions already supported by the backend
6. Navigation integration
7. Proper loading/error/success states

The user should be able to:

- view their profile
- edit supported public profile information
- see their username/account identifier
- update profile information if the backend supports it
- access Settings
- logout
- understand account/session state

Keep the implementation simple.

---

# IMPORTANT — Inspect Before Coding

Before modifying code:

1. Inspect the current mobile architecture.
2. Inspect the existing `/me` implementation from PROMPT 012.
3. Inspect the existing backend User APIs.
4. Inspect User DTOs.
5. Inspect validation rules.
6. Inspect authentication endpoints.
7. Inspect whether profile update already exists.
8. Inspect whether password change already exists.
9. Inspect the current navigation.
10. Inspect existing UI patterns.

Do NOT assume that profile update or password change APIs exist.

Use the actual backend implementation as the source of truth.

If an API does not exist, do NOT automatically build a large backend feature.

---

# Fixed Technology Constraints

Keep the existing:

- React Native
- Expo
- TypeScript
- navigation
- API client
- authentication provider
- secure token storage

Do NOT migrate frameworks.

Do NOT introduce a new state-management framework.

Do NOT add unnecessary dependencies.

---

# 1. Profile Screen

Create:

```text
ProfileScreen
```

The screen should display the authenticated user's available public information.

Conceptually:

```text
Profile

[ Avatar / Placeholder ]

Nguyen Van A
@username

Email:
example@email.com

[ Edit Profile ]

[ Settings ]
```

Use only fields actually exposed by the backend `/me` response.

Do NOT assume email should be displayed publicly.

Follow the backend's actual response model.

---

# 2. Profile Information

Potential fields include:

- display name
- username
- email
- avatar
- bio

However:

**Only implement fields that already exist in the backend model/API.**

Do not create new profile fields simply to make the screen look more complete.

If the backend only provides:

```text
id
username
displayName
```

then use those fields.

Do not invent:

```text
bio
phone
birthday
gender
address
```

unless they already exist in the project.

---

# 3. Edit Profile

Create:

```text
EditProfileScreen
```

Only allow editing fields supported by the existing backend.

For example:

```text
Display Name
[ Nguyen Van A ]

Username
[ nguyenvana ]

[ Save Changes ]
```

If username is immutable according to the backend, display it as read-only.

Do not allow editing immutable fields.

---

# 4. Profile Update API

First inspect whether an endpoint already exists.

If it exists, reuse it.

Possible conceptual endpoint:

```text
PATCH /api/v1/users/me
```

But do NOT assume this exact endpoint.

Use the actual backend endpoint.

Create a typed API method such as:

```text
updateMyProfile(...)
```

Do not call the API directly from the UI component.

---

# 5. Profile Validation

Use backend validation rules.

At minimum:

- trim text inputs where appropriate
- reject invalid empty required values
- respect backend maximum lengths
- display validation errors clearly

Do not duplicate complicated validation rules.

If backend returns field-level validation errors, map them to the corresponding fields where practical.

---

# 6. Save Behavior

When the user presses Save:

1. Validate the form.
2. Prevent duplicate submission.
3. Show loading state.
4. Call the backend.
5. Update local authenticated user state.
6. Return to Profile.
7. Show success feedback.

Do not force a full app restart.

Do not require the user to login again unless the backend explicitly invalidates the session.

---

# 7. Auth User State Synchronization

The user information displayed in:

- Home
- Profile
- Edit Profile

should remain consistent.

Reuse the auth/user state from PROMPT 012.

After a successful profile update:

- update the existing authenticated user state
- do not create a second user state store

Avoid duplicated user state across screens.

---

# 8. Avatar

First inspect whether the existing backend already supports avatars.

### If avatar support already exists

Implement the simplest compatible UI.

### If avatar upload does NOT exist

Do not implement file upload in this milestone.

Instead:

- show a placeholder/avatar generated from the user's display name or username
- keep the implementation simple

Do NOT add:

- image upload backend
- object storage
- S3
- Cloudinary
- image cropping
- image compression

unless the project already has this infrastructure.

---

# 9. Settings Screen

Create:

```text
SettingsScreen
```

Keep Settings intentionally simple.

Possible layout:

```text
Settings

Account
  Profile

Security
  Change Password

Application
  Theme

Session
  Logout
```

Only include features actually supported by the project.

Do not create fake settings that do nothing.

---

# 10. Change Password

First inspect the backend.

If password-change functionality already exists:

- integrate it into Settings.

If it does NOT exist:

- do not implement a new authentication/password-reset system in this milestone
- do not store or handle passwords locally
- clearly report that it is not implemented because backend support is missing

If the existing backend supports password change, create:

```text
ChangePasswordScreen
```

with:

```text
Current Password
[ ******** ]

New Password
[ ******** ]

Confirm New Password
[ ******** ]

[ Change Password ]
```

Follow the backend's actual validation requirements.

---

# 11. Password Security

Never:

- log passwords
- persist passwords
- put passwords into navigation parameters
- include passwords in analytics
- expose passwords in error messages

Clear password fields after successful submission.

Use secure text entry.

---

# 12. Logout

Reuse the existing logout implementation from PROMPT 012.

Settings should provide:

```text
[ Logout ]
```

On logout:

1. Clear authentication state.
2. Clear secure token storage according to existing implementation.
3. Close/cleanup authenticated WebSocket connections.
4. Navigate to Login.
5. Prevent authenticated screens from remaining accessible.

Do NOT create a second logout mechanism.

---

# 13. WebSocket Cleanup

Because Chat and Notification features use WebSocket:

Logout must not leave authenticated WebSocket connections running.

Reuse the existing WebSocket lifecycle/service from PROMPT 015/016.

After logout:

- disconnect authenticated WebSocket connections where appropriate
- remove subscriptions
- remove listeners
- avoid reconnecting after logout

Do not create a new WebSocket manager solely for logout.

---

# 14. Navigation

Integrate Profile and Settings into authenticated navigation.

Conceptually:

```text
Home
├── Search Users
├── Nearby Users
├── Friends
├── Messages
├── Notifications
└── Profile
    └── Settings
```

Use the existing navigation system.

Do not replace it.

Unauthenticated users must not access Profile or Settings.

---

# 15. Home Integration

Add a simple Profile entry point to Home.

For example:

```text
[ Profile ]
```

Do not redesign the Home screen.

Keep the existing Home functionality unchanged.

---

# 16. Profile Refresh

Profile should display current server state.

Use the existing `/me` API or equivalent.

If profile data can become stale:

- provide pull-to-refresh
- or reload when entering the screen

Do not create background polling.

---

# 17. Loading States

Implement clear loading states.

Examples:

```text
Loading profile...
Saving...
Changing password...
Logging out...
```

Prevent duplicate actions.

Do not freeze unrelated parts of the application.

---

# 18. Error Handling

Handle:

- network error
- unauthorized
- forbidden
- validation error
- duplicate username if applicable
- server error

Use the existing API error-handling architecture.

Do not display raw stack traces.

Use concise user-friendly messages.

---

# 19. Success Feedback

After successful operations, show appropriate feedback.

Examples:

```text
Profile updated successfully.
```

```text
Password changed successfully.
```

```text
Logged out.
```

Use the existing notification/toast/message mechanism if one already exists.

Do not introduce a large UI library solely for toast messages.

---

# 20. Theme Setting

First inspect whether the project already has a theme/dark-mode architecture.

### If theme support already exists

Expose a simple setting if appropriate:

```text
Theme
[ System / Light / Dark ]
```

### If theme support does NOT exist

Do NOT implement a complete theming system in this milestone.

You may leave Theme out of Settings.

Do not add a large theme architecture just for this screen.

---

# 21. Account Information

If useful and already available from the backend, Profile may display:

- username
- email
- account creation date

Only display fields that actually exist.

Do not expose:

- password
- password hash
- JWT
- internal database information
- private location
- security tokens

---

# 22. API Layer

Reuse/create a typed User API service.

Conceptually:

```text
userApi.ts
```

Possible methods:

```text
getMyProfile(...)
updateMyProfile(...)
```

Only add methods supported by the backend.

Do not put REST calls directly inside screens.

---

# 23. TypeScript Types

Create/reuse types for:

- Current user
- Profile
- Update profile request
- Update profile response
- Change password request if supported

Do not use `any`.

Do not duplicate user types unnecessarily.

Reuse the existing Auth/User types where appropriate.

---

# 24. Tests

Use the existing mobile testing setup.

Add focused tests.

## Profile

Test:

- profile loads
- profile fields render
- loading state
- error state
- refresh behavior

## Edit Profile

Test:

- existing values populate form
- validation works
- Save calls API
- successful update updates user state
- API error is handled
- duplicate submission is prevented

## Settings

Test:

- Profile navigation works
- Change Password navigation works if supported
- Logout works

## Authentication regression

Verify:

- logout clears auth
- Login screen appears
- authenticated screens are inaccessible after logout

## WebSocket regression

Verify that logout does not leave authenticated subscriptions active where practical.

---

# 25. Manual Verification

Use a real test account.

## Profile

1. Login.
2. Open Profile.
3. Confirm correct user information.
4. Pull/refresh if implemented.
5. Confirm no private/security fields are shown.

## Edit Profile

1. Open Edit Profile.
2. Change display name or another supported field.
3. Save.
4. Confirm success.
5. Return to Profile.
6. Confirm updated value.
7. Navigate to Home.
8. Confirm the updated user state is reflected there where applicable.

## Validation

Test:

- empty required field
- too-long value
- invalid value
- duplicate username if applicable

## Password

If backend supports password change:

1. Open Change Password.
2. Test incorrect current password.
3. Test invalid new password.
4. Test mismatched confirmation.
5. Successfully change password.
6. Verify login behavior according to backend session rules.

If backend does not support password change, document that limitation.

## Logout

1. Open Settings.
2. Logout.
3. Confirm Login screen appears.
4. Confirm authenticated screens are inaccessible.
5. Confirm Chat/Notification WebSocket does not reconnect after logout.

---

# 26. Backend Compatibility

Prefer a mobile-only implementation.

Before modifying backend:

1. Inspect current User APIs.
2. Inspect current Auth APIs.
3. Determine what profile/security functionality already exists.
4. Reuse existing APIs.

If backend changes are genuinely necessary:

- make the smallest compatible change
- preserve existing API behavior
- add backend tests
- explain the reason

Do NOT refactor unrelated backend modules.

---

# 27. Scope Protection

DO NOT implement:

- Push notifications
- Avatar upload infrastructure
- Cloud storage
- Account deletion
- Email verification
- Phone verification
- Two-factor authentication
- Social login
- Password reset email flow
- Privacy policy UI
- Terms of service UI
- Block/report system
- Advanced account settings
- Location history/settings
- Notification preferences unless already implemented
- Data export
- Admin functionality

These belong to later milestones.

---

# 28. Regression Protection

Do not break:

- Register
- Login
- Logout
- Home
- User Search
- Nearby Users
- Friends
- Friend Requests
- Conversations
- Chat
- WebSocket Chat
- Notifications
- WebSocket Notifications

Verify existing backend tests still pass.

Do not rewrite working authentication code unnecessarily.

---

# 29. Validation

Run:

```bash
cd apps/mobile
npx tsc --noEmit
```

Run the existing mobile tests.

Run the existing mobile build/check command.

If backend code was modified:

```bash
cd backend
.\mvnw.cmd test
```

Only report commands that were actually executed.

Do not mark the milestone complete if validation fails.

---

# 30. Code Quality

Follow the existing project conventions.

Prefer:

- small screens/components
- typed API methods
- reusable form components where appropriate
- centralized user state
- clear validation
- existing authentication architecture
- minimal dependencies

Avoid:

- duplicated user state
- duplicated API clients
- giant Profile/Settings components
- `any`
- unnecessary backend refactoring
- unrelated code cleanup

---

# 31. Final Report

When finished, report:

## Changed

List:

- Profile screen
- Edit Profile screen
- Settings screen
- password change if supported
- logout integration
- WebSocket cleanup
- navigation
- API services
- TypeScript types
- tests

## Backend Changes

Explicitly state:

```text
Backend changed: YES/NO
```

Prefer:

```text
Backend changed: NO
```

If YES:

- explain why
- list files changed
- list tests changed

## Unsupported Backend Features

If something was intentionally not implemented because the backend does not support it, explicitly state it.

Example:

```text
Password change: NOT IMPLEMENTED — backend endpoint does not currently exist.
```

## Validation

Report exact commands and actual results.

Example:

```text
npx tsc --noEmit    PASS
npm test            PASS
.\mvnw.cmd test     PASS
```

Only report commands actually executed.

## Manual Verification

Report:

- profile
- edit profile
- validation
- password flow if supported
- logout
- WebSocket cleanup

## Scope Check

Confirm that these were NOT implemented:

- Push notifications
- Avatar upload infrastructure
- Account deletion
- 2FA
- Social login
- Password reset
- Advanced account settings

---

# Completion Rule

Only report:

```text
PROMPT_017 COMPLETE
```

if:

- Profile screen works
- Edit Profile works for supported backend fields
- Settings works
- Logout works
- WebSocket cleanup works
- authentication/security is preserved
- tests pass
- TypeScript validation passes
- regression checks pass

If a feature is not supported by the backend, do not fake it. Clearly report the limitation.

Otherwise report:

```text
PROMPT_017 NOT COMPLETE
```

and clearly list:

1. what is incomplete
2. what failed
3. what remains to be fixed

Do not mark the milestone complete just because the application compiles.

# End of PROMPT 017