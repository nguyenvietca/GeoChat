# PROMPT 016 — Mobile Notification UI & Realtime Notifications

## Context

GeoChat is a beginner-friendly but technically grounded mobile + web application.

Previous milestones are complete:

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

The backend Notification functionality from PROMPT 011 already exists.

The backend supports notification types conceptually including:

- `FRIEND_REQUEST_RECEIVED`
- `FRIEND_REQUEST_ACCEPTED`
- `NEW_MESSAGE`

Use the actual backend enum/types and API contracts.

Do NOT rebuild the notification backend.

---

# Goal

Implement the Notification experience on mobile.

The mobile user should be able to:

1. Open a Notifications screen.
2. View persisted notifications.
3. See unread/read state.
4. See unread notification count.
5. Mark an individual notification as read.
6. Mark all notifications as read.
7. Receive new notifications in realtime when supported by the existing backend.
8. Navigate from a notification to the relevant screen when appropriate.
9. See a notification badge/count in the authenticated UI.
10. Handle loading, empty, error, and realtime connection states.

This milestone covers **in-app notifications only**.

Do NOT implement push notifications.

---

# IMPORTANT — Inspect Before Coding

Before modifying code:

1. Inspect the current mobile project.
2. Inspect PROMPT 012/013/014/015 implementation.
3. Inspect the existing API client.
4. Inspect the current navigation structure.
5. Inspect the backend Notification APIs.
6. Inspect the backend Notification DTOs.
7. Inspect notification types.
8. Inspect whether the backend already broadcasts notifications through WebSocket.
9. Inspect the actual WebSocket destination/authentication mechanism.
10. Inspect existing Chat WebSocket code from PROMPT 015.

Do NOT assume:

- endpoint names
- DTO fields
- notification payload format
- WebSocket destinations
- WebSocket subscription paths

Use the actual backend implementation as the source of truth.

---

# Fixed Technology Constraints

Keep the existing mobile stack.

Expected:

- React Native
- Expo
- TypeScript

Do NOT migrate the framework.

Do NOT introduce another state-management library.

Do NOT add Redux/Zustand/MobX/TanStack Query unless the project already uses one.

Reuse existing:

- API client
- authentication
- secure token storage
- navigation
- WebSocket infrastructure
- UI conventions

---

# 1. Notifications Screen

Create:

```text id="v4cv1b"
NotificationsScreen
```

The screen should display notifications for the authenticated user.

Conceptually:

```text id="h9dr0p"
Notifications

3 unread

Alice sent you a friend request
2 min ago

Bob accepted your friend request
1 hour ago

Charlie sent you a message
Yesterday

[ Mark all as read ]
```

Use the actual backend notification fields.

Do not invent fields that do not exist.

---

# 2. Notification List API

Use the existing backend endpoint from PROMPT 011.

Conceptually:

```http id="m4e4yw"
GET /api/v1/notifications
```

Inspect the backend for:

- pagination
- sorting
- response structure
- unread state
- timestamps

Use the actual contract.

Do not create a new backend endpoint if the existing endpoint is sufficient.

---

# 3. Notification Types

Support the notification types already implemented by the backend.

Expected types include:

```text id="1mx83a"
FRIEND_REQUEST_RECEIVED
FRIEND_REQUEST_ACCEPTED
NEW_MESSAGE
```

Use the actual enum values.

Each notification should have an appropriate human-readable representation.

Conceptually:

```text id="5xywiv"
FRIEND_REQUEST_RECEIVED
→ "Alice sent you a friend request"

FRIEND_REQUEST_ACCEPTED
→ "Alice accepted your friend request"

NEW_MESSAGE
→ "You have a new message from Alice"
```

Do not hard-code assumptions about sender information if it is not included in the notification DTO.

---

# 4. Notification Item

Create a small reusable notification item component.

For example:

```text id="x95xk6"
NotificationItem
```

The item should visually distinguish:

- unread
- read

Example:

```text id="8xj7s2"
● Alice sent you a friend request
  2 minutes ago
```

versus:

```text id="chj4gf"
  Alice sent you a friend request
  2 minutes ago
```

Keep the visual distinction simple.

---

# 5. Mark Individual Notification as Read

Use the existing backend endpoint.

Conceptually:

```http id="k5r6hh"
POST /api/v1/notifications/{notificationId}/read
```

When a notification is marked as read:

- update the UI
- decrease the unread count
- do not reload the entire app
- prevent duplicate requests

Use the actual backend contract.

---

# 6. Mark All Notifications as Read

Use:

```http id="g6e4so"
POST /api/v1/notifications/read-all
```

or the actual existing endpoint.

After success:

- all displayed notifications become read
- unread count becomes zero

Handle API errors without corrupting local state.

---

# 7. Unread Count

Use:

```http id="8q8ez0"
GET /api/v1/notifications/unread-count
```

or the actual endpoint.

Display unread count in the authenticated UI.

Possible locations:

```text id="oytkn9"
Home
  Notifications (3)
```

or:

```text id="8d8g3e"
🔔 3
```

Use the existing navigation/UI conventions.

Do not introduce a complicated notification center architecture.

---

# 8. Notification Entry Point

Add Notifications to authenticated navigation.

Conceptually:

```text id="6z8n8n"
Home
├── Search Users
├── Nearby Users
├── Friends
├── Messages
└── Notifications
```

Use the existing navigation architecture.

Do not replace the navigation library.

Unauthenticated users must not access Notifications.

---

# 9. Home Integration

Add a simple Notifications entry point to Home.

For example:

```text id="m72hj7"
[ Notifications ]
```

If the current Home UI supports badges, show the unread count.

Do not redesign the entire Home screen.

Do not introduce unrelated UI changes.

---

# 10. Realtime Notifications

First inspect the backend.

Determine whether PROMPT 011 already broadcasts notifications through WebSocket.

If the backend already provides realtime notification delivery:

- reuse the existing WebSocket infrastructure
- subscribe to the appropriate user-specific notification destination
- handle incoming notification payloads
- update the notification list
- increment unread count

Do NOT invent a new backend WebSocket destination.

Do NOT modify the backend if the existing implementation already supports this.

---

# 11. WebSocket Authentication

Use the existing authenticated JWT/WebSocket mechanism from PROMPT 015.

Do not create another authentication flow.

Do not store another JWT.

Do not log:

- JWT
- Authorization header
- WebSocket credentials

---

# 12. User-Specific Notification Subscription

Notifications are private user data.

The mobile client must subscribe only to the authenticated user's notification destination.

Do not subscribe to a global notification stream.

Do not expose one user's notifications to another user.

The backend remains responsible for authorization.

---

# 13. Realtime Notification Lifecycle

When Notifications screen/app-level notification service starts:

1. Establish/reuse authenticated WebSocket connection.
2. Subscribe to the user's notification destination.
3. Receive notification events.
4. Update local notification state.
5. Increment unread count if appropriate.

When the relevant lifecycle ends:

- unsubscribe
- remove listeners
- avoid duplicate subscriptions
- avoid memory leaks

Do not create multiple WebSocket connections unnecessarily.

---

# 14. Realtime + REST Deduplication

Be careful about:

1. REST loads existing notifications.
2. WebSocket delivers a new notification.
3. The same notification could potentially be encountered through refresh/reload.

Use the notification's unique backend identifier where available.

Do not deduplicate only by:

- message text
- timestamp
- notification type

Do not display the same notification multiple times.

---

# 15. Global Notification State

The unread count should be accessible from the authenticated UI.

Keep this implementation simple.

Possible approach:

```text id="j9l2od"
NotificationProvider
```

or another lightweight context/service consistent with the current project.

Do not introduce a new global state-management framework.

The state should support:

- unread count
- notification updates
- marking read
- mark all read
- realtime additions

Do not store unnecessary notification history globally if the Notifications screen already owns it.

---

# 16. Refresh

Notifications screen should support refreshing.

Refresh should:

1. request notifications
2. request/update unread count if needed
3. reconcile local state

Do not implement background polling.

Realtime updates should be handled through WebSocket where supported.

---

# 17. Pagination

Inspect the backend notification API.

If it supports pagination:

- use it
- load the first page initially
- support loading older notifications

Prefer a simple "load more" or infinite-scroll approach.

Do not fetch the entire notification history if the backend already supports pagination.

---

# 18. Empty State

If there are no notifications:

Display:

```text id="3p4wcm"
No notifications yet.
```

Do not treat an empty list as an error.

---

# 19. Loading State

Display appropriate loading states.

Examples:

```text id="a8upx1"
Loading notifications...
```

For mark/read actions:

```text id="n6f6l7"
Marking as read...
```

Do not freeze the entire application for an individual notification action.

---

# 20. Error Handling

Handle:

- network error
- unauthorized
- forbidden
- validation error
- server error
- WebSocket connection failure

Use the existing error-handling architecture.

Do not display raw backend stack traces.

For WebSocket failure:

- show a subtle connection status if useful
- allow/reuse reconnect behavior from PROMPT 015
- do not crash the application

---

# 21. Notification Navigation

Where the notification contains enough information to determine the relevant resource, tapping it should navigate to the appropriate screen.

Expected conceptual behavior:

### Friend Request Received

Navigate to:

```text
Friends → Incoming Requests
```

### Friend Request Accepted

Navigate to:

```text
Friends
```

### New Message

Navigate to:

```text
Messages → relevant conversation
```

However:

**Do not guess identifiers.**

Use the actual reference fields provided by the notification backend.

If a notification does not contain enough information to safely navigate:

- mark it as read
- do not navigate anywhere

Do not create additional APIs solely to guess the destination.

---

# 22. Notification Read Behavior

A practical behavior:

When the user taps a notification:

1. Mark it as read if unread.
2. Update unread count.
3. Navigate if a valid target exists.

Do not mark unrelated notifications as read.

---

# 23. Friend Request Notification Flow

Verify the full flow:

### Account A

1. Search B.
2. Send friend request.

### Account B

1. Receive `FRIEND_REQUEST_RECEIVED`.
2. Notification appears.
3. Unread count increases.
4. Tap notification.
5. Navigate to Incoming Friend Requests.
6. Notification becomes read.

### Account B

1. Accept request.

### Account A

1. Receive `FRIEND_REQUEST_ACCEPTED`.
2. Notification appears.
3. Unread count increases.
4. Tap notification.
5. Navigate to Friends.

Do not modify Friend business logic unless necessary.

---

# 24. New Message Notification Flow

Use the existing backend behavior.

Expected:

### Account A

1. Open Chat with B.
2. Send a message.

### Account B

If the backend generates `NEW_MESSAGE`:

1. Receive notification.
2. Notification appears.
3. Unread count updates.
4. Tap notification.
5. Navigate to the relevant conversation.

Important:

If the backend already suppresses notifications when the recipient is actively viewing the conversation, respect that behavior.

Do not implement client-side notification suppression unless the backend contract requires it.

---

# 25. Chat Integration

Reuse the Chat implementation from PROMPT 015.

Do not create another chat navigation flow.

If a notification references a conversation:

- navigate through the existing ChatScreen route
- pass the conversation ID using the established navigation pattern

Do not duplicate conversation loading logic.

---

# 26. API Layer

Create/reuse:

```text id="9c7d8s"
notificationApi.ts
```

Conceptually:

```text id="y3b6r0"
getNotifications(...)
getUnreadCount(...)
markNotificationRead(...)
markAllNotificationsRead(...)
```

Use actual endpoint names and DTOs.

Do not make HTTP requests directly from UI components.

---

# 27. TypeScript Types

Create/reuse types for:

- Notification
- Notification type
- Notification list response
- Unread count response
- Notification reference/resource data
- WebSocket notification payload

Do not use `any`.

Do not duplicate notification types.

---

# 28. Date/Time Formatting

Display notification timestamps in a human-friendly way.

Examples:

```text id="z9jv4r"
Just now
5 min ago
2 hours ago
Yesterday
```

If a simple formatter is sufficient, implement a small reusable utility.

Respect the actual timestamp format returned by the backend.

Do not introduce a large date library unless already used by the project.

---

# 29. Notification Ordering

Use the backend's ordering contract if available.

Prefer newest notifications first.

Do not reorder based on client clock if the backend already supplies authoritative timestamps/order.

---

# 30. Tests

Use the existing mobile testing setup.

Add focused tests.

## Notification API

Test:

- notification list request
- unread count request
- mark read request
- mark all read request

## Notification Screen

Test:

- notifications render
- unread/read visual state
- empty state
- loading state
- error state

## Read behavior

Test:

- individual notification becomes read
- unread count updates
- mark all read sets count to zero

## Notification navigation

Test:

- friend request notification → Friends
- accepted notification → Friends
- message notification → Chat
- notification without valid target → no unsafe navigation

## Realtime

Where practical, test:

- notification event received
- notification added
- unread count incremented
- duplicate notification prevented
- cleanup/unsubscribe

If full WebSocket testing is impractical in the current environment, use focused service-level tests and document the limitation.

---

# 31. Manual Verification

Use at least two test accounts.

## Friend Request Notification

### Account A

1. Search Account B.
2. Send friend request.

### Account B

3. Confirm notification appears.
4. Confirm unread count increases.
5. Open Notifications.
6. Confirm notification is displayed as unread.
7. Tap it.
8. Confirm it becomes read.
9. Confirm navigation to Friend Requests.

## Friend Accepted Notification

### Account B

1. Accept Account A's request.

### Account A

2. Confirm notification appears.
3. Confirm unread count increases.
4. Open notification.
5. Confirm navigation to Friends.

## Message Notification

### Account A

1. Open Chat with B.
2. Send a text message.

### Account B

3. Confirm NEW_MESSAGE notification if the backend generates it.
4. Confirm unread count.
5. Tap notification.
6. Confirm navigation to the relevant ChatScreen.

## Mark All Read

1. Generate multiple unread notifications.
2. Open Notifications.
3. Select Mark all as read.
4. Confirm all become read.
5. Confirm unread count becomes zero.

## Refresh

1. Generate a notification from another account.
2. Pull to refresh.
3. Confirm it appears.

## Realtime

If backend realtime notification delivery exists:

1. Keep Notifications/Home open.
2. Generate a notification from another account.
3. Confirm the notification appears without manual refresh.

---

# 32. Security / Privacy

Notifications are private user data.

Ensure:

- authenticated API client is used
- notification data is not exposed to unauthenticated screens
- user-specific WebSocket subscription is used
- JWT is not logged
- notification contents are not unnecessarily logged
- internal IDs are not exposed unnecessarily

Do not trust client-side user IDs for notification authorization.

Backend authorization remains the source of truth.

---

# 33. Scope Protection

DO NOT implement:

- Push notifications
- Expo Notifications
- Firebase Cloud Messaging
- APNs
- notification permissions
- background notification handlers
- notification sounds
- notification vibration
- notification actions
- email notifications
- SMS notifications
- notification preferences/settings
- notification grouping
- advanced notification filtering
- notification search
- social activity feed

This milestone is **in-app notification UI + existing realtime delivery only**.

Push notifications belong to a later milestone.

---

# 34. Regression Protection

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
- Location functionality

Verify existing backend tests still pass.

Do not rewrite working Chat WebSocket code unnecessarily.

If a shared WebSocket service must be changed, preserve the existing Chat behavior.

---

# 35. Validation

Run:

```bash id="6d8mqa"
cd apps/mobile
npx tsc --noEmit
```

Run the existing mobile tests.

Run the existing mobile build/check command.

If backend code was modified:

```bash id="91s9jv"
cd backend
.\mvnw.cmd test
```

Only report commands actually executed.

Do not report COMPLETE if validation fails.

---

# 36. Code Quality

Follow the existing architecture.

Prefer:

- small components
- typed API services
- reusable notification item
- centralized notification type mapping
- simple notification state
- existing WebSocket infrastructure
- minimal dependencies

Avoid:

- duplicated WebSocket connections
- duplicated API clients
- giant components
- `any`
- unnecessary abstractions
- unrelated refactoring

---

# 37. Final Report

When finished, report:

## Changed

List:

- Notifications screen
- notification item
- notification API service
- unread count
- mark read
- mark all read
- notification navigation
- WebSocket/realtime integration
- global unread state
- Home/navigation integration
- TypeScript types
- tests

## Backend Changes

Explicitly state:

```text id="3v70b1"
Backend changed: YES/NO
```

Prefer:

```text id="zq7p7f"
Backend changed: NO
```

If YES:

- explain why
- list files changed
- list tests changed

## Validation

Report exact commands and actual results.

Example:

```text id="t7m1v8"
npx tsc --noEmit    PASS
npm test            PASS
.\mvnw.cmd test     PASS
```

Only report commands actually executed.

## Manual Verification

Report:

- friend request notification
- friend accepted notification
- message notification
- unread count
- mark read
- mark all read
- notification navigation
- realtime behavior if tested

## Scope Check

Confirm that these were NOT implemented:

- Push notifications
- Expo Notifications
- FCM/APNs
- notification permissions
- background notifications
- sounds/vibration
- notification settings
- email/SMS notifications

---

# Completion Rule

Only report:

```text id="o6k8kq"
PROMPT_016 COMPLETE
```

if:

- Notifications screen works
- Notification list works
- Unread count works
- Individual read works
- Mark all read works
- Notification navigation works
- Existing realtime notification mechanism works when provided by backend
- Chat/Friend integration works
- authentication/security is preserved
- tests pass
- TypeScript validation passes
- regression checks pass

Otherwise report:

```text id="q4m3y6"
PROMPT_016 NOT COMPLETE
```

and clearly list:

1. what is incomplete
2. what failed
3. what remains to be fixed

Do not mark the milestone complete just because the application compiles.

# End of PROMPT 016