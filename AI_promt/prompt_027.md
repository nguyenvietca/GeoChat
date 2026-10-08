# PROMPT_027 — Web Group Chat + Facebook-style Messages Layout

## Context

GeoChat is a mobile + web social location-based chat application.

Current stack:

- Java 21
- Spring Boot 4.1.0
- PostgreSQL
- PostGIS
- Flyway
- JWT authentication
- WebSocket/STOMP
- React + TypeScript web application
- React Native / Expo mobile application
- Modular monolith backend
- Existing DIRECT chat functionality
- Existing GROUP chat backend from PROMPT_025
- Existing Mobile Group Chat from PROMPT_026
- Existing Web Direct Chat from PROMPT_020
- Existing Web Notifications from PROMPT_021
- Existing Web Profile/Settings from PROMPT_022
- Existing integration/security hardening from PROMPT_023
- Existing UX/production polish from PROMPT_024

The Web application already supports authentication, friends, direct chat, notifications, profile/settings, and realtime messaging.

PROMPT_025 introduced GROUP conversations on the backend.

PROMPT_026 implemented Mobile Group Chat.

This prompt is for the **Web application only**.

---

# Goal

Implement Web Group Chat and redesign the Web Messages experience into a Facebook-style two-panel layout.

The Messages page should behave approximately like:

```text
+-------------------------------------------------------------+
|                         Messages                            |
+-------------------------+-----------------------------------+
|                         |                                   |
|  Friends / Chats        |        Selected Conversation      |
|                         |                                   |
|  40%                    |               60%                 |
|  LEFT                   |              RIGHT                |
|                         |                                   |
|  Friend A               |  Friend A                         |
|  Friend B               |  -----------------------------   |
|  Friend C               |  Hello                            |
|  Group ABC              |                         Hi!       |
|  Group XYZ              |  -----------------------------   |
|                         |                                   |
|                         |  [ Type a message... ] [Send]     |
|                         |                                   |
+-------------------------+-----------------------------------+
```

The exact visual design does not need to copy Facebook.

The goal is to provide a familiar **messaging split-view UX**:

- Left panel ≈ 40%
- Right panel ≈ 60%
- Left panel contains Friends / conversations
- Right panel contains the selected conversation
- Clicking a friend opens the direct conversation on the right
- Clicking a group opens the group conversation on the right
- Do not navigate away from the Messages page for normal conversation switching on desktop

---

# IMPORTANT — Inspect Before Coding

Before making changes:

1. Inspect the existing Web application structure.
2. Inspect the existing Messages/Chat/Friends implementation from PROMPT_020.
3. Inspect the existing routing/navigation.
4. Inspect the existing API client.
5. Inspect existing TypeScript types.
6. Inspect existing WebSocket/STOMP implementation.
7. Inspect the actual backend implementation from PROMPT_025.
8. Inspect the actual group DTOs, endpoints, conversation model, member model, and WebSocket destinations.
9. Inspect PROMPT_026 implementation only when necessary to understand the actual backend contract.
10. Reuse existing architecture and components where possible.

Do NOT invent API contracts if the backend already provides them.

Do NOT duplicate the WebSocket implementation.

Do NOT create a second chat architecture.

---

# 1. Messages Page — Split Layout

Redesign the existing Web Messages page into a two-panel layout.

Target proportions:

```text
LEFT  = approximately 40%
RIGHT = approximately 60%
```

Use a flexible responsive implementation rather than hardcoding exact pixel widths.

For example:

```text
grid-template-columns: minmax(280px, 40%) minmax(0, 60%)
```

or an equivalent layout appropriate for the existing UI architecture.

The layout should:

- occupy the available Messages page height
- keep the left list independently usable
- keep the right chat area independently usable
- avoid unnecessary full-page navigation
- preserve the existing application shell/header/sidebar if one already exists

Do not introduce a new UI framework just for this layout.

---

# 2. Left Panel — Friends / Conversations

The left panel should contain the user's available chat targets.

It should feel similar to a messaging application's conversation sidebar.

At minimum, support:

### Direct conversations

Display:

- friend's display name
- avatar if the existing application supports avatars
- latest message preview if available
- relevant timestamp if available
- unread indicator if already supported by the existing system

### Group conversations

Display:

- group name
- group avatar/icon if the existing application has one
- latest message preview if available
- relevant timestamp if available
- unread indicator if already supported

Do not create a new avatar system.

If the backend does not provide avatars, use the existing fallback UI.

---

# 3. Friends Integration

The user specifically wants the left side to behave like a Friends list.

Therefore:

- Existing Friends data should be reusable.
- Existing friend relationship logic must remain unchanged.
- Existing friend APIs must be reused.
- Do not duplicate friend-management APIs.
- Do not allow non-friends to become direct-chat targets.

If the existing Messages implementation already has a conversation list, integrate Friends into that experience instead of maintaining two unrelated lists.

Recommended behavior:

```text
Friends / Chats

[Search friends if existing search UI supports it]

FRIENDS
--------------------------------
Friend A
Friend B
Friend C

GROUPS / CONVERSATIONS
--------------------------------
Family
Gaming Group
Travel Group
```

However, if the existing backend already exposes a reliable conversation list, prefer that as the source of truth for existing conversations.

Do not make unnecessary backend changes.

---

# 4. Click Friend → Open Message on Right

When the user clicks a friend:

```text
Left:
[Friend A]  ← selected

Right:
+--------------------------------------+
| Friend A                             |
|--------------------------------------|
|                                      |
| Hello                                |
|                          Hi          |
|                                      |
|--------------------------------------|
| Type a message...             [Send] |
+--------------------------------------+
```

The right panel must update without leaving the Messages page.

Expected behavior:

1. User clicks Friend A.
2. Determine/create the existing DIRECT conversation using the existing API.
3. Load message history.
4. Display the conversation in the right panel.
5. Subscribe to the correct WebSocket destination.
6. Allow sending messages.
7. Reuse existing JWT/WebSocket authorization.
8. Reuse existing message deduplication.

Do not reload the entire page.

---

# 5. Click Group → Open Group Message on Right

When the user clicks a group:

```text
Left:
[GeoChat Group]  ← selected

Right:
+--------------------------------------+
| GeoChat Group                        |
|--------------------------------------|
| Alice: Hello                         |
| Bob: Hi                              |
| Me: Welcome                          |
|--------------------------------------|
| Type a message...             [Send] |
+--------------------------------------+
```

The right panel should:

- display group name
- display group messages
- display sender identity for messages from other members
- allow sending text messages
- load message history
- subscribe to group WebSocket updates
- deduplicate incoming messages
- clean up previous conversation subscriptions

Use the actual GROUP conversation implementation from PROMPT_025.

Do not create a separate group-chat protocol.

---

# 6. Web Group Chat Creation

Add a Web UI for creating a group conversation.

Use the existing Friends data.

The user should be able to:

1. Click "Create Group" or equivalent action.
2. Enter a group name.
3. Select friends.
4. Create the group.
5. Automatically become the group owner.
6. Open the newly created group in the right chat panel.

Validation:

- group name is required
- trim whitespace
- reasonable maximum length based on backend validation
- at least the backend-required number of members
- user cannot select themselves
- duplicate friends cannot be selected
- prevent duplicate submission
- show loading state while creating

Use the actual backend constraints from PROMPT_025.

Do not duplicate validation rules unnecessarily if the backend already defines them.

---

# 7. Group Information

Provide a lightweight group information UI.

Possible interaction:

```text
Group Name
Members: 4

Alice — Owner
Bob
Charlie
David
```

At minimum:

- group name
- member count
- member list
- owner indication

Reuse the existing backend group/member APIs.

Do not implement advanced member administration.

---

# 8. Leave Group

For group conversations:

- members should be able to leave if supported by the backend
- show confirmation before leaving
- after successful leave:
  - remove/refresh the group from the left panel
  - clear the selected conversation if necessary
  - show the empty state on the right

If the current user is the owner and the backend prevents the owner from leaving, display a clear message.

Do not implement ownership transfer in this prompt.

---

# 9. Empty State for Right Panel

When no conversation is selected, the right panel should not appear broken.

Display a clean empty state such as:

```text
Select a friend or group
to start chatting
```

or an equivalent existing GeoChat empty-state design.

The empty state should be visually centered in the right panel.

---

# 10. Message History

Reuse the existing REST message history implementation.

Requirements:

- existing pagination behavior must continue working
- preserve existing loading state
- preserve existing empty state
- preserve existing error state
- avoid duplicate API calls
- avoid resetting the whole page when changing conversations

If existing chat history uses infinite scrolling or "load older messages", keep that behavior.

Do not replace working pagination with a simpler implementation.

---

# 11. WebSocket / STOMP

Reuse the existing WebSocket/STOMP infrastructure.

For each selected conversation:

1. Subscribe to the appropriate destination.
2. Receive realtime messages.
3. Update the right panel.
4. Deduplicate messages using the stable backend message ID.
5. Do not duplicate messages when:
   - REST history contains the message
   - WebSocket delivers the same message
   - reconnect occurs

When switching conversations:

```text
Conversation A selected
        ↓
unsubscribe A
        ↓
select Conversation B
        ↓
subscribe B
```

Do not leave stale subscriptions active.

On logout:

- disconnect/cleanup WebSocket as the existing architecture requires.

---

# 12. Conversation Switching

Conversation switching must be smooth.

Example:

```text
Friend A selected
    ↓
Right panel = Friend A

Friend B selected
    ↓
Right panel = Friend B

Group ABC selected
    ↓
Right panel = Group ABC

Friend A selected again
    ↓
Right panel = Friend A
```

Requirements:

- no full-page reload
- no duplicated WebSocket subscriptions
- no stale messages from previous conversation
- correct loading state
- correct selected state in left panel
- preserve draft text only if the existing architecture supports per-conversation drafts

Do not introduce complex state management just for drafts.

---

# 13. Browser Refresh / Deep Linking

If the existing application supports conversation route parameters, preserve them.

If it does not, do NOT introduce complex routing solely for this feature.

At minimum:

- refreshing Messages should not crash
- Messages page should load normally
- no selected conversation should show the empty state
- selecting a conversation should work normally

If an existing route convention can safely support:

```text
/messages/:conversationId
```

you may reuse it.

Do not break existing routes.

---

# 14. Responsive Behavior

The 40/60 split is primarily for desktop/tablet widths where there is enough horizontal space.

For narrow mobile-sized browser widths, do NOT force both panels into an unusable layout.

Recommended behavior:

```text
Desktop:
+-------------+----------------------+
|    40%      |         60%          |
| conversations|       messages       |
+-------------+----------------------+

Small screen:
+-----------------------------------+
| Conversations                     |
+-----------------------------------+
```

When a conversation is selected on a narrow viewport, it may transition to a full-width chat view.

Provide a clear way to return to the conversation list.

Do not break the existing mobile web responsiveness.

---

# 15. Friends Page Regression

Do not remove or break the existing dedicated Friends functionality.

The existing Friends page should continue to support:

- friend list
- incoming requests
- outgoing requests
- accept
- reject
- cancel
- existing relationship states

The Messages page is simply adding a Friends/conversation-oriented entry point.

Do not duplicate friend-management logic.

---

# 16. Notifications Integration

Existing notification behavior must continue working.

When a notification refers to:

- a direct message
- a group message, if group notifications are already supported

the user should be able to navigate to the relevant conversation when the backend already provides enough information.

Do not introduce a new notification architecture.

If group notifications were not implemented by the backend, do not invent them here.

---

# 17. Unread State

Reuse the existing notification/unread infrastructure where applicable.

For conversations:

- show unread indication if existing backend/UI state supports it
- do not invent a new unread-message database model
- do not introduce read receipts
- do not implement message read-status synchronization in this prompt

Keep unread handling limited to what the existing system already supports.

---

# 18. TypeScript Types

Use the actual backend DTOs.

Ensure types correctly represent:

```text
DIRECT conversation
GROUP conversation
group metadata
group members
messages
sender information
```

Avoid:

```text
any
```

unless unavoidable at a specific integration boundary.

Do not duplicate slightly different interfaces for the same backend object.

Prefer shared existing types.

---

# 19. API Layer

Extend the existing Web API client.

Do not create a second HTTP client.

Expected operations should map to the actual backend implementation, including as applicable:

- create group
- list groups/conversations
- get group
- get group members
- leave group
- get messages
- send message
- create/get direct conversation

IMPORTANT:

Use the actual endpoints and DTOs implemented by PROMPT_025.

If endpoint names differ, use the existing implementation instead of forcing the examples above.

---

# 20. Error Handling

Handle:

- failed group creation
- invalid group name
- invalid members
- unauthorized group access
- group not found
- failed message history
- failed message send
- WebSocket connection failure
- reconnect
- leave-group failure

Use the existing application error handling patterns.

Avoid raw technical errors such as:

```text
500 Internal Server Error
```

when a user-friendly message can be displayed.

---

# 21. Loading States

Every async operation should have a meaningful loading state.

Examples:

```text
Loading conversations...

Loading messages...

Creating group...

Sending...

Leaving group...
```

Do not allow duplicate buttons/actions while an operation is in progress.

---

# 22. Empty States

Provide useful empty states for:

### No friends

```text
No friends yet.
Add friends to start chatting.
```

### No conversations

```text
No conversations yet.
Select a friend to start a conversation.
```

### No messages

```text
No messages yet.
Send the first message.
```

### No selected conversation

```text
Select a friend or group to start chatting.
```

Use existing GeoChat UI conventions where possible.

---

# 23. Accessibility

Follow basic accessibility practices:

- buttons must have accessible labels
- form fields must have labels/placeholders
- selected conversation should be visually distinguishable
- keyboard navigation should remain usable
- focus should not become trapped
- send action should be accessible using Enter where the existing chat UX supports it

Do not over-engineer accessibility in this prompt.

---

# 24. Performance

Avoid unnecessary requests and renders.

Requirements:

- do not fetch all messages for every friend when opening Messages
- load messages only for the selected conversation
- avoid repeatedly recreating WebSocket subscriptions
- avoid duplicate conversation creation
- avoid N+1 API calls where existing backend APIs already provide conversation/member data
- use stable React keys based on backend IDs
- avoid unnecessary global state

Do not add Redux/Zustand/etc. unless the project already uses one.

---

# 25. Security

Frontend checks are not security boundaries.

Ensure:

- JWT is still used through the existing authentication mechanism
- protected APIs remain protected
- group members cannot access unauthorized group messages
- frontend does not assume that hiding a conversation provides security
- backend remains the source of truth for authorization

Do not weaken existing authentication or WebSocket authorization.

---

# 26. Direct Chat Regression

After implementing group chat, verify that DIRECT chat still works.

Test:

```text
User A
  ↓
Friend B
  ↓
Open Messages
  ↓
Select B
  ↓
Load history
  ↓
Send message
  ↓
B receives realtime message
```

Then:

```text
A switches to Group
  ↓
A switches back to B
  ↓
No duplicate messages
  ↓
WebSocket subscription remains correct
```

---

# 27. Group Chat Manual Verification

Use at least three test accounts:

```text
A = Group Owner
B = Group Member
C = Non-member
```

### Scenario 1 — Create Group

A:

1. Open Messages.
2. Click Create Group.
3. Enter group name.
4. Select B.
5. Create group.

Expected:

- group is created
- A is owner
- B is member
- group appears in left panel
- group opens in right panel

### Scenario 2 — Group Messaging

A:

1. Open group.
2. Send message.

B:

1. Open same group.
2. Receive message through WebSocket.

Expected:

- message appears once
- sender identity is correct

### Scenario 3 — Non-member Authorization

C attempts to access the group.

Expected:

- backend rejects unauthorized access
- frontend displays an appropriate error
- C cannot read or send group messages

### Scenario 4 — Conversation Switching

A:

```text
Friend B
   ↓
Group ABC
   ↓
Friend C
   ↓
Group ABC
```

Expected:

- right panel always shows the correct conversation
- no stale messages
- no duplicate messages
- no duplicated WebSocket events

### Scenario 5 — Leave Group

B:

1. Open group.
2. Leave group.
3. Confirm.

Expected:

- B leaves successfully
- group disappears or updates from the left panel
- B cannot send further messages
- A remains able to use the group

---

# 28. UI/UX Acceptance Criteria

The Messages page should visually communicate:

```text
+------------------------------------------------------------+
| Messages                                                   |
+--------------------------+---------------------------------+
| Friends / Conversations  | Selected Conversation            |
|                          |                                 |
| Friend A                 | Friend A                        |
| Friend B                 |                                 |
| Friend C                 | Hello                           |
|                          |                         Hi      |
| Groups                   |                                 |
| Group ABC                | -----------------------------   |
| Group XYZ                | Type a message...       [Send]   |
+--------------------------+---------------------------------+
        ~40%                         ~60%
```

Acceptance criteria:

- approximately 40/60 split
- left panel is conversation/friend navigation
- right panel is active chat
- clicking friend updates right panel
- clicking group updates right panel
- direct chat continues to work
- group chat works
- realtime messaging works
- switching conversations works
- no stale subscriptions
- no duplicate messages
- responsive behavior works
- existing Friends page still works
- existing Notifications page still works
- existing authentication still works

---

# 29. Tests

Add/update tests appropriate to the existing Web testing setup.

At minimum test important behavior such as:

- Messages page renders
- split layout renders
- empty state renders when no conversation selected
- clicking a friend selects the correct conversation
- clicking a group selects the correct conversation
- group creation validation
- group creation success
- message history loading
- message send
- WebSocket message handling
- duplicate WebSocket message is ignored
- switching conversations cleans up previous subscription
- leave group behavior
- error state rendering

Do not introduce a completely new testing framework.

Follow the project's existing testing conventions.

---

# 30. Build and Validation

Run the appropriate commands for the actual Web project.

At minimum:

```bash
npm run build
```

and the existing test/typecheck commands if available.

If the project has:

```bash
npm run test
npm run typecheck
```

run them as appropriate.

Fix all introduced errors.

Do not leave:

- TypeScript errors
- lint errors introduced by this task
- broken imports
- broken routes
- broken API calls

---

# 31. Regression Verification

Verify existing Web functionality:

### Authentication

- login
- register
- logout
- protected routes

### Home

- existing Home behavior

### Search

- user search still works

### Nearby

- nearby users still work

### Friends

- friend list
- requests
- accept/reject/cancel

### Messages

- direct chat
- group chat
- WebSocket
- message history
- conversation switching

### Notifications

- list
- unread count/badge
- mark read

### Profile

- profile
- settings
- logout

Do not regress existing functionality.

---

# 32. Scope Protection

DO NOT implement in this prompt:

- media/file upload
- image messages
- video messages
- voice messages
- message reactions
- typing indicators
- read receipts
- message editing
- message deletion
- reply/quote messages
- message forwarding
- advanced search
- group member administration
- ownership transfer
- invite links
- public groups
- group discovery
- map integration
- location sharing
- background location
- new push notification architecture
- new state-management framework
- new backend architecture
- new authentication system

Focus only on:

```text
Web Group Chat
+
Facebook-style Messages split layout
+
Friends/Conversation left panel
+
Selected Chat right panel
+
Realtime messaging
```

---

# 33. Final Report

When implementation is finished, report:

1. Files/components changed.
2. Group chat functionality implemented.
3. Messages 40/60 split layout implemented.
4. Friends/conversations left panel behavior.
5. Direct chat behavior.
6. Group chat behavior.
7. WebSocket changes.
8. API changes.
9. Tests added/updated.
10. Build/test/typecheck results.
11. Manual verification performed.
12. Any known limitations.

At the very end, output exactly one of:

```text
PROMPT_027 COMPLETE
```

or:

```text
PROMPT_027 NOT COMPLETE
```

Do not claim COMPLETE if any required acceptance criterion is still failing.