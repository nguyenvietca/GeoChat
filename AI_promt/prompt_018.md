# PROMPT_018 — Mobile Push Notifications

## Context

GeoChat already has:

- Mobile authentication
- User search
- Nearby users
- Friend system
- Direct chat
- Realtime WebSocket messaging
- In-app notifications
- Notification screen
- Profile / Settings / Logout
- Spring Boot backend
- PostgreSQL
- JWT authentication
- React Native / Expo mobile app

The previous milestone implemented in-app notifications.

This milestone adds **real mobile push notifications** for important GeoChat events.

Do not redesign the existing notification system.

---

# Goal

Implement mobile push notification support so that:

1. Mobile app can request notification permission.
2. Mobile app can obtain a push/device token.
3. Mobile app registers the token with the backend.
4. Backend stores push tokens securely per user/device.
5. Backend can send push notifications for existing notification events.
6. Push notifications work for:
   - friend request received
   - friend request accepted
   - new direct message
7. Tapping a push notification opens the appropriate screen.
8. Existing in-app notifications continue working.
9. Logout removes/deactivates the device token.
10. Existing authentication, chat, friend, and notification behavior must not regress.

---

# IMPORTANT — Inspect Before Coding

Before changing anything, inspect the actual project.

### Mobile

Inspect:

- Expo version
- React Native version
- `app.json` / `app.config.*`
- existing notification-related dependencies
- existing navigation structure
- existing WebSocket implementation
- existing auth provider/state
- existing notification provider/state
- current environment configuration
- whether the project is using Expo Go, development builds, or another setup

### Backend

Inspect:

- existing notification module
- notification entity/model
- notification service
- notification creation flow
- friend request flow
- friend acceptance flow
- chat message creation flow
- authentication/security configuration
- existing user model
- database migration structure
- current environment configuration

Do NOT invent APIs or duplicate existing services.

Reuse the existing notification creation flow whenever possible.

---

# Technology Constraints

## Backend

Keep:

- Java 21
- Spring Boot 4.1.0
- Maven Wrapper
- PostgreSQL
- Flyway
- JWT
- existing modular monolith architecture

Do not introduce another backend framework.

## Mobile

Keep the existing:

- React Native
- Expo
- TypeScript
- navigation solution
- API client
- auth state management

Do not replace the current mobile architecture.

Prefer the simplest push solution compatible with the existing Expo setup.

If the project is an Expo-managed application and there is no existing push infrastructure, prefer:

- `expo-notifications`
- Expo Push Service

unless inspection shows that the current architecture requires another approach.

Do not migrate the entire application to another notification provider.

---

# 1. Mobile Push Notification Setup

Inspect the current Expo configuration first.

Add only the dependencies/configuration actually required.

Implement:

- notification permission request
- notification token registration
- notification event listeners
- foreground notification handling
- notification response/tap handling

Do not request notification permission immediately on every app launch.

Use a sensible lifecycle such as after authentication or when the application is ready to register the device.

Handle permission states:

- granted
- denied
- not determined
- unavailable

The application must not crash if push notification permission is denied.

---

# 2. Push Token Registration

After the authenticated user is available:

1. Request permission if appropriate.
2. Obtain the push/device token.
3. Register it with the backend.

Do not store the push token as application authentication credentials.

Do not expose the token unnecessarily in logs.

Do not repeatedly create duplicate registrations.

The mobile app should use the existing API client and authentication mechanism.

Example API shape only:

```text
POST /api/v1/notifications/devices
```

But:

**DO NOT assume this exact endpoint exists.**

Inspect the backend first and implement the actual API consistently with the existing project conventions.

Possible request information:

```text
token
platform
device identifier
```

Only collect information that is actually necessary.

---

# 3. Backend Device Token Storage

Add backend support for user push devices if it does not already exist.

Prefer a dedicated table/entity such as:

```text
user_push_devices
```

Possible fields:

```text
id
user_id
push_token
platform
device_identifier
created_at
updated_at
active
```

Adapt the exact structure to the existing project conventions.

Requirements:

- token belongs to a user
- token must not be globally duplicated
- multiple devices per user are supported
- inactive/invalid tokens can be disabled
- authenticated users can register their own tokens only
- users cannot register tokens for another user
- logout can deactivate/remove the current device token

Add appropriate database constraints and indexes.

Create a Flyway migration.

Do not store plaintext authentication secrets.

---

# 4. Device Token API

Implement the minimum APIs required by the mobile application.

At minimum support:

### Register/update device

```text
POST /api/v1/notifications/devices
```

### Remove/deactivate device

```text
DELETE /api/v1/notifications/devices/{deviceId}
```

Use the actual project API conventions after inspection.

Requirements:

- JWT authentication required
- user ownership enforced
- idempotent registration where practical
- no cross-user access
- validation for required fields
- safe handling of duplicate tokens

Do not expose other users' device tokens.

---

# 5. Push Notification Service

Create a backend abstraction for sending push notifications.

For example:

```text
PushNotificationService
```

The exact package/class naming should follow the existing project architecture.

Responsibilities:

- find active devices for a user
- construct push payload
- send push notification
- handle provider response
- deactivate invalid/expired tokens when appropriate

Do not put provider-specific HTTP logic directly inside:

- FriendService
- ChatService
- NotificationController

Keep provider integration isolated.

---

# 6. Push Provider Configuration

Do not hardcode credentials.

Use environment/configuration properties.

For example:

```text
PUSH_NOTIFICATIONS_ENABLED=false
```

and provider-specific configuration as required.

Do not commit secrets.

Development should be safe when push notifications are disabled.

When disabled:

- normal friend/chat/notification functionality must still work
- application startup must not fail
- notification records must still be created

---

# 7. Existing Notification Events

Reuse the existing notification creation flow.

Push notifications should be triggered for:

### Friend request

Existing notification:

```text
FRIEND_REQUEST_RECEIVED
```

Send a push to the recipient.

### Friend accepted

Existing notification:

```text
FRIEND_REQUEST_ACCEPTED
```

Send a push to the original requester.

### New direct message

Existing notification:

```text
NEW_MESSAGE
```

Send a push to the recipient.

Do not create a second independent notification domain flow.

Prefer:

```text
Domain event
    ↓
Notification creation
    ↓
Push notification
```

or another clean architecture consistent with the existing implementation.

---

# 8. Push Payload

Push payload should contain only the minimum information required by the mobile application.

For example:

```text
type
notificationId
conversationId
friendRequestId
senderId
```

Only include IDs that are relevant to the notification.

Do not send:

- passwords
- JWT tokens
- private user information
- sensitive database information
- unnecessary message content

For a new message, avoid exposing the full message body in the push payload unless the existing privacy/design explicitly requires it.

A safer default is:

```text
"New message from <display name>"
```

with navigation metadata.

---

# 9. Mobile Notification Navigation

When the user taps a push notification:

### Friend request

Navigate to:

```text
Friends
→ Incoming Requests
```

### Friend accepted

Navigate to:

```text
Friends
```

### New message

Navigate to:

```text
Chat
→ corresponding conversation
```

### Generic notification

Navigate to:

```text
Notifications
```

Use the existing navigation architecture.

Do not introduce a new navigation framework.

---

# 10. Foreground Notifications

When the application is already open:

Do not create confusing duplicate behavior.

Reuse the existing in-app notification state where appropriate.

Handle foreground push notifications according to the existing UX.

At minimum:

- receive notification
- update/refresh relevant in-app notification state
- avoid creating duplicate notification records

Do not make the same backend notification appear multiple times simply because push was delivered.

---

# 11. Background / Cold Start

Handle:

- application in background
- application completely closed
- application opened by tapping a notification

Notification tap data must survive the application startup process.

After authentication/navigation state is ready, route the user to the appropriate destination.

Avoid navigating before the navigation container is initialized.

---

# 12. Logout Behavior

Update the existing logout flow.

Before/while logging out:

1. deactivate/remove the current device registration
2. close existing WebSocket connections
3. clear authentication state
4. clear secure token storage
5. navigate to Login

If device-token removal fails because the network is unavailable:

- logout must still succeed
- do not leave the user stuck on the logout process

---

# 13. Token Lifecycle

Handle common token lifecycle situations:

- first registration
- repeated app startup
- token changes
- multiple devices
- logout
- invalid/expired provider token

Backend should deactivate tokens that the push provider explicitly reports as invalid where supported.

Do not delete all devices when one device logs out.

---

# 14. Error Handling

Push notification failures must NOT break core GeoChat functionality.

For example:

If:

```text
friend request
```

is successfully created but push delivery fails:

The friend request must still exist.

Likewise:

If:

```text
chat message
```

is successfully saved but push delivery fails:

The chat message must still exist.

Push delivery is a secondary side effect.

Do not make the main transaction dependent on successful external push delivery.

---

# 15. Security

Verify:

- device registration requires JWT
- user can only manage own devices
- push tokens are never returned unnecessarily
- push provider credentials are environment-based
- no secrets are committed
- no JWT appears inside push payload
- no sensitive message content is exposed unnecessarily

Do not trust user-supplied `userId` for ownership.

Always derive the authenticated user from the security context.

---

# 16. Tests

Add backend tests for:

### Device registration

- authenticated registration succeeds
- unauthenticated registration fails
- duplicate token is handled correctly
- user cannot register/manage another user's device

### Device removal

- owner can remove/deactivate own device
- another user cannot remove it

### Push triggering

Test that:

- friend request creates the expected push request
- friend accepted creates the expected push request
- new message creates the expected push request

Also test:

- push disabled → core operation still succeeds
- push provider failure → core operation still succeeds
- invalid push token handling does not break the main operation

Mock the external push provider.

Do NOT make automated tests depend on real Expo/FCM/APNs delivery.

---

# 17. Mobile Tests / Validation

At minimum verify:

- TypeScript passes
- notification permission flow does not crash
- denied permission does not block app usage
- token registration uses authenticated API client
- notification response handling works
- navigation data is parsed safely
- logout cleanup does not break authentication

If the existing project has a mobile test framework, add appropriate tests there.

Do not introduce a large new testing framework only for this milestone.

---

# 18. Manual Verification

Use a real physical device where required.

Verify at least:

### Scenario A — Friend request

User A sends a friend request to User B.

Expected:

- friend request is created
- in-app notification appears
- User B receives push notification
- tapping push opens Friends / Incoming Requests

### Scenario B — Friend accepted

User B accepts User A's request.

Expected:

- friendship is created
- in-app notification appears
- User A receives push notification
- tapping push opens Friends

### Scenario C — New message

User A sends a message to User B.

Expected:

- message is persisted
- WebSocket behavior remains correct
- in-app notification remains correct
- User B receives push when appropriate
- tapping push opens the correct conversation

### Scenario D — Logout

User logs out.

Expected:

- authentication is cleared
- WebSocket is disconnected
- device registration is deactivated/removed
- user does not continue receiving pushes for the logged-out session

### Scenario E — Push disabled

Disable push configuration.

Expected:

- application still starts
- login works
- friends work
- chat works
- in-app notifications work
- no push-provider crash occurs

---

# 19. Validation Commands

Run the appropriate existing commands.

Backend:

```bash
cd backend
.\mvnw.cmd test
```

Mobile:

```bash
cd mobile
npx tsc --noEmit
```

If the project already has a mobile test/build command, run it as well.

Also run the existing web validation if the backend/mobile changes could affect shared packages.

---

# 20. Scope Protection

DO NOT implement:

- notification preferences
- notification categories/settings
- rich notifications
- notification actions
- media attachments
- push analytics
- delivery analytics
- read receipts
- group chat push
- calls
- voice/video notifications
- account deletion
- password reset
- social login
- background location
- map functionality
- redesign of existing notification UI
- migration to another state-management framework

Do not refactor unrelated modules.

Do not replace the existing WebSocket implementation.

Do not replace the existing in-app notification system.

---

# 21. Completion Criteria

PROMPT_018 is complete only when:

- [ ] Mobile push permission flow implemented
- [ ] Mobile push/device token obtained
- [ ] Device token registered with backend
- [ ] Backend stores multiple user devices safely
- [ ] Device removal/deactivation implemented
- [ ] Push provider integration isolated
- [ ] Provider configuration uses environment variables
- [ ] Friend request push implemented
- [ ] Friend accepted push implemented
- [ ] New message push implemented
- [ ] Push tap navigation implemented
- [ ] Foreground/background/cold-start behavior handled
- [ ] Logout cleans up device registration
- [ ] Push failure does not break core operations
- [ ] Backend tests pass
- [ ] Mobile TypeScript validation passes
- [ ] Existing functionality still works
- [ ] Manual verification completed as far as the available device/build environment allows

If physical-device/provider configuration prevents real push delivery verification, clearly report that limitation.

Do NOT claim full push verification if it was not actually tested.

---

# Final Report

At the end, report:

```text
PROMPT_018 COMPLETE
```

only if all applicable completion criteria are satisfied.

Otherwise report:

```text
PROMPT_018 NOT COMPLETE
```

Then list:

1. What was implemented
2. Files changed
3. Database migrations added
4. APIs added/changed
5. Push provider/configuration used
6. Tests executed
7. Manual verification performed
8. Known limitations
9. Any remaining work

Do not silently expand the scope.