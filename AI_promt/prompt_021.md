# PROMPT_021 — Web Notifications & Realtime Notifications

## Context

GeoChat Web already has:

- Web Foundation
- Authentication
- Login/Register
- Protected Routes
- Home
- User Search
- Nearby Users
- Friends
- Friend Requests
- Direct Chat
- Realtime WebSocket Chat
- Central API Client
- Central Authentication State

The backend already provides:

- Persistent notifications
- Notification types
- Notification REST APIs
- Notification creation for:
  - friend request received
  - friend request accepted
  - new direct message
- Realtime WebSocket/STOMP infrastructure
- JWT authentication

The mobile application already implements the corresponding notification behavior and can be used as a behavioral reference.

---

# Goal

Implement the complete Web notification experience.

The Web application must support:

1. Notification API integration
2. Notifications page
3. Notification list
4. Read/unread state
5. Unread notification count
6. Mark individual notification as read
7. Mark all notifications as read
8. Realtime notification delivery through WebSocket
9. Notification navigation
10. Notification badge in the Web application shell
11. Deduplication of REST and WebSocket notifications
12. Loading / empty / error states
13. Responsive UI
14. Proper WebSocket cleanup on logout

Do NOT implement browser push notifications.

Do NOT modify the existing mobile push notification system.

---

# 1. Inspect Before Coding

Before making changes, inspect the actual project.

## Backend

Inspect:

- Notification controller
- Notification service
- Notification entity/model
- Notification DTOs
- Notification types
- unread-count API
- mark-read API
- mark-all-read API
- notification creation flow
- WebSocket configuration
- notification WebSocket destination
- JWT WebSocket authentication
- user-specific subscription/authorization

Confirm the actual contracts.

Do NOT assume endpoint names or WebSocket destinations from this prompt.

## Web

Inspect:

- existing API client
- AuthProvider
- WebSocket/STOMP implementation from PROMPT_020
- application shell
- navigation
- routing
- chat WebSocket connection
- existing state-management approach
- reusable notification/badge components if any

## Mobile

Use the existing mobile notification implementation as a behavioral reference where useful.

Do not copy mobile-specific architecture into Web.

---

# 2. Fixed Technology Constraints

Keep:

- React
- TypeScript
- Vite
- existing router
- existing API client
- existing authentication architecture
- existing STOMP/WebSocket implementation

Backend remains:

- Java 21
- Spring Boot 4.1.0
- PostgreSQL
- Flyway
- JWT
- Spring WebSocket/STOMP

Do NOT:

- use Supabase
- replace STOMP
- introduce polling for realtime notifications
- introduce Redux/Zustand unnecessarily
- create another authentication mechanism
- modify mobile push notifications

---

# 3. Notification API Layer

Create or extend the centralized notification API.

Conceptually:

```text id="m0s6nz"
notificationsApi.getNotifications(...)
notificationsApi.getUnreadCount()
notificationsApi.markAsRead(...)
notificationsApi.markAllAsRead()
```

These are conceptual names only.

Use the actual backend endpoints.

All API calls must use the centralized API client.

Do not make raw HTTP requests directly from UI components.

---

# 4. Notification Types

Use the actual backend notification types.

Expected existing types include:

```text id="k1t8cw"
FRIEND_REQUEST_RECEIVED
FRIEND_REQUEST_ACCEPTED
NEW_MESSAGE
```

Do not invent new notification types.

Create TypeScript types matching the backend DTO.

Possible conceptual model:

```text id="x8r2jd"
Notification
    id
    type
    title/message
    read
    createdAt
    reference data
```

Use the actual backend response fields.

Avoid `any`.

---

# 5. Notifications Route

Add:

```text id="m6e8kq"
/app/notifications
```

to the authenticated application.

Add Notifications to the Web navigation/application shell.

The page must be protected by the existing authentication mechanism.

---

# 6. Notifications Page

Create a simple notification page.

Example:

```text id="y7f3qv"
Notifications

--------------------------------
● Alice sent you a friend request
  5 minutes ago

○ Bob accepted your friend request
  1 hour ago

○ Charlie sent you a message
  2 hours ago
--------------------------------

[Mark all as read]
```

The exact visual design is flexible.

Unread notifications must be visually distinguishable from read notifications.

Keep the UI consistent with the existing Web application.

---

# 7. Notification List

Display notifications using the actual backend DTO.

For each notification:

- readable message/title
- created time/date
- read/unread state
- appropriate navigation action

Do not expose unnecessary internal IDs.

Do not expose sensitive backend information.

---

# 8. Unread Count

Integrate the existing unread-count API.

Display the unread count in the application shell.

Example:

```text id="p2n5yv"
Notifications (3)
```

or:

```text id="b9w4xm"
🔔 3
```

Use the existing UI style.

Requirements:

- count loads after authentication
- count updates after marking notification read
- count updates after mark-all-read
- count updates when realtime notification arrives
- zero should not show a misleading badge

---

# 9. Notification State

Create a lightweight notification state.

It should support:

```text id="q6s2pa"
notifications
unreadCount
loading
error
```

Use the existing application architecture.

Do NOT introduce a new global state library.

If the existing AuthProvider/Application Provider architecture can naturally host notification state, reuse it.

Keep notification state separate from authentication state unless there is a clear reason otherwise.

---

# 10. Initial Notification Loading

After authentication is ready:

1. load unread count
2. load notifications when the Notifications page is opened
3. avoid unnecessary duplicate API calls

Do not load the complete notification history repeatedly on every route change.

Use a reasonable caching/state approach consistent with the current project.

---

# 11. Pagination

Inspect the backend notification API.

If pagination is already supported:

- implement the existing pagination contract
- provide load more/infinite scroll as appropriate

If pagination is not supported:

- do not redesign the backend solely for this milestone
- use the existing response safely

Do not fetch an unbounded notification history.

---

# 12. Mark Individual Notification as Read

When the user opens/clicks an unread notification:

Call the existing mark-read API.

Conceptually:

```text id="7n8w2d"
POST /api/v1/notifications/{notificationId}/read
```

Use the actual backend endpoint.

After success:

- notification becomes read
- unread count decreases
- UI updates without full page reload

Do not decrement the count if the notification was already read.

---

# 13. Mark All as Read

Implement:

```text id="2v4m9p"
Mark all as read
```

Use the actual backend endpoint.

After success:

- all visible notifications become read
- unread count becomes zero
- UI updates immediately

Handle repeated clicks safely.

---

# 14. Notification Navigation

Use the notification type/reference data to navigate.

## Friend Request Received

Navigate to:

```text id="x7v9c2"
/app/friends
```

Preferably focus/identify the Incoming Requests section if the existing Friends UI supports it.

## Friend Request Accepted

Navigate to:

```text id="q2m8s6"
/app/friends
```

## New Message

Navigate to:

```text id="j4f8n1"
/app/chat/{conversationId}
```

using the actual conversation reference from the notification.

Do not guess IDs from notification text.

---

# 15. Realtime WebSocket Notifications

Reuse the WebSocket/STOMP infrastructure implemented in PROMPT_020.

Do NOT create a second WebSocket implementation.

Inspect the backend's actual notification destination.

Conceptually it may look like:

```text id="a7z2k9"
/user/{userId}/queue/notifications
```

or another destination defined by the backend.

Use the actual configuration.

---

# 16. WebSocket Authentication

Use the existing JWT WebSocket authentication mechanism.

The notification subscription must only become active after:

```text id="z3c8wp"
authenticated user
+
valid JWT
+
WebSocket connected
```

Do not subscribe before authentication is ready.

Do not expose JWT tokens in UI or notification payloads.

---

# 17. User-Specific Notification Subscription

Subscribe only to the authenticated user's notification destination.

Never subscribe to:

- another user's notification channel
- arbitrary user IDs
- global private notification channels

Backend authorization remains the final security boundary.

---

# 18. Realtime Notification Handling

When a realtime notification arrives:

1. validate payload
2. convert it to the typed Notification model
3. add it to notification state
4. increment unread count
5. optionally show a lightweight in-app indicator
6. do not duplicate existing notification records

Do not automatically navigate the user.

Navigation happens when the user clicks the notification.

---

# 19. REST + WebSocket Deduplication

A notification may exist through:

```text id="x0a6mz"
REST notification list
+
WebSocket notification
```

Do not display duplicates.

Use the stable backend notification ID.

Conceptually:

```text id="8q2d5m"
if notification.id already exists:
    update existing notification
else:
    add notification
```

Do not use notification text as the unique identifier.

---

# 20. Notification Badge Updates

When a realtime notification arrives:

```text id="y6p4rz"
notification arrives
 ↓
notifications state updated
 ↓
unreadCount + 1
 ↓
badge updated
```

When an unread notification is marked as read:

```text id="m4c7tx"
mark read
 ↓
notification.read = true
 ↓
unreadCount - 1
```

When mark-all-read succeeds:

```text id="d8v2qs"
unreadCount = 0
```

Ensure the count never becomes negative.

---

# 21. Foreground Behavior

This milestone uses **in-app realtime notifications**, not browser push.

When the Web application is open:

- receive realtime notification
- update badge
- update notification state
- optionally show a lightweight toast/banner if the existing UI has a notification mechanism

Do not introduce a large toast/notification framework solely for this feature.

Do not show browser system notifications.

---

# 22. Notification Page Refresh

When the user opens/reloads:

```text id="p8k5cz"
/app/notifications
```

the page must load the current server state.

Do not rely solely on WebSocket memory.

REST remains the source of truth for persisted notifications.

---

# 23. Loading States

Handle:

- initial unread count loading
- notification list loading
- mark-read loading
- mark-all-read loading
- WebSocket connecting
- WebSocket reconnecting

Do not block the entire application because notifications are loading.

The user should still be able to use:

- Home
- Search
- Nearby
- Friends
- Chat

---

# 24. Empty State

If there are no notifications:

```text id="f6x9w2"
You're all caught up.
```

or another simple message consistent with the existing UI.

Do not treat empty notifications as an error.

---

# 25. Error Handling

Handle:

- unauthorized
- notification not found
- already read
- backend unavailable
- network error
- WebSocket disconnect
- malformed realtime payload

Use the existing Web error handling.

Do not expose:

- stack traces
- SQL errors
- JWT
- internal server details

If WebSocket fails:

- notification page must still work through REST
- badge can recover on next refresh/API request
- application must not crash

---

# 26. WebSocket Reconnection

Reuse the reconnect behavior from PROMPT_020.

After reconnect:

1. restore authenticated WebSocket connection
2. restore notification subscription
3. avoid duplicate subscriptions

Do not create multiple notification subscriptions after repeated reconnects.

---

# 27. Logout

Update logout cleanup if necessary.

On logout:

1. unsubscribe notification subscription
2. disconnect/cleanup WebSocket resources
3. clear notification state
4. clear authentication
5. navigate to Login

Logout must succeed even if WebSocket cleanup fails.

After logout, the previous user's notification data must not remain visible.

---

# 28. Security

Verify:

- notification REST APIs use JWT
- notification WebSocket uses JWT
- user only receives own notifications
- notification IDs are not treated as authorization
- frontend does not trust user IDs from URL/query parameters
- sensitive backend information is not rendered
- JWT is never included in UI
- notification payload is safely rendered

Backend remains responsible for authorization.

---

# 29. TypeScript Types

Create/reuse typed models:

```text id="t5x8kn"
Notification
NotificationType
NotificationPage
UnreadNotificationCount
```

Use actual backend DTOs.

Do not invent fields.

Avoid `any`.

---

# 30. Tests

Inspect the existing Web test setup.

Add tests for:

## Notification API

- notification list loads
- unread count loads
- mark one read
- mark all read
- API errors

## Notification UI

- unread notification displayed correctly
- read notification displayed correctly
- empty state
- loading state
- error state

## Navigation

- friend request notification → Friends
- accepted notification → Friends
- message notification → Chat

## Realtime

Test notification handling logic:

- incoming notification added
- unread count incremented
- duplicate notification ignored
- malformed notification handled
- notification for current user handled correctly

## Read State

- marking unread notification read decreases count
- marking already-read notification does not decrement count
- mark-all-read sets count to zero

Mock WebSocket transport where practical.

Do not depend on a production WebSocket server for unit tests.

---

# 31. Validation

Run the existing Web commands.

At minimum:

```bash id="5r2h8s"
cd apps/web
npm run build
```

Also run available:

```bash id="z7c4m1"
npm run test
npm run lint
npm run typecheck
```

Only run commands that actually exist.

Fix all errors introduced by this milestone.

---

# 32. Manual Verification

Use at least two test accounts.

## Scenario A — Friend Request

User A sends a friend request to User B.

Verify:

```text id="s2j7k4"
User B
 ↓
realtime notification appears
 ↓
unread badge increases
```

## Scenario B — Notification Page

User B opens Notifications.

Verify:

- notification appears
- notification is unread
- timestamp/message is correct

## Scenario C — Open Notification

Click the friend request notification.

Verify:

```text id="v9n3x1"
notification marked read
 ↓
unread count decreases
 ↓
Friends page opens
```

## Scenario D — Accept Friend

User B accepts the request.

Verify User A receives:

```text id="c4w8p6"
FRIEND_REQUEST_ACCEPTED
```

in realtime.

## Scenario E — New Message

User A sends a direct message to User B.

Verify User B receives:

```text id="r5m2q8"
NEW_MESSAGE
```

in realtime.

Click it and verify Chat opens to the correct conversation.

## Scenario F — Mark All Read

Create multiple unread notifications.

Click:

```text id="n6v3k9"
Mark all as read
```

Verify:

- all notifications become read
- badge becomes zero

## Scenario G — Reconnect

Temporarily disconnect/reconnect the network.

Verify:

- WebSocket reconnects
- notification subscription is restored
- no duplicate notifications appear

## Scenario H — Logout

Logout.

Verify:

- notification subscription is removed
- notification state is cleared
- previous user's notifications are not visible after next login

---

# 33. Regression Check

Verify existing functionality:

- Login
- Register
- Auth restoration
- Home
- User Search
- Nearby
- Friends
- Friend Requests
- Direct Chat
- WebSocket Chat

Do not break existing mobile functionality.

Do not modify backend behavior unnecessarily.

---

# 34. Scope Protection

DO NOT implement:

- Browser Push Notifications
- Web Push API
- service workers for notifications
- notification preferences
- notification settings
- rich notifications
- notification actions
- email notifications
- SMS notifications
- analytics
- delivery tracking
- notification history redesign
- Group Chat notifications
- Calls
- Profile
- Settings
- Admin dashboard
- complex UI redesign
- new global state-management framework

Mobile push notifications were already handled in PROMPT_018.

---

# 35. Completion Criteria

PROMPT_021 is complete only when:

## REST

- [ ] Notification API integrated
- [ ] Notification list works
- [ ] Unread count works
- [ ] Mark one as read works
- [ ] Mark all as read works

## UI

- [ ] Notifications page implemented
- [ ] Read/unread state visible
- [ ] Notification badge implemented
- [ ] Loading states implemented
- [ ] Empty state implemented
- [ ] Error states implemented
- [ ] Responsive UI works

## Realtime

- [ ] WebSocket notification subscription works
- [ ] JWT authentication works
- [ ] Realtime notification appears
- [ ] Unread count updates
- [ ] REST/WebSocket duplicates are prevented
- [ ] Reconnect works
- [ ] Subscription cleanup works

## Navigation

- [ ] Friend request → Friends
- [ ] Friend accepted → Friends
- [ ] New message → correct Chat conversation

## Quality

- [ ] Tests added/updated
- [ ] TypeScript passes
- [ ] Web build passes
- [ ] Existing functionality still works
- [ ] Manual verification completed

---

# Final Report

Report:

```text id="e7w3p9"
PROMPT_021 COMPLETE
```

only if all applicable completion criteria are satisfied.

Otherwise:

```text id="k5m8q2"
PROMPT_021 NOT COMPLETE
```

Then report:

1. What was implemented
2. Files changed
3. Pages/routes added
4. Notification APIs integrated
5. WebSocket notification destination
6. Authentication approach
7. Notification navigation
8. Any backend changes
9. Tests executed
10. Build/typecheck results
11. Manual verification
12. Known limitations
13. Remaining work

Do not silently expand the scope.