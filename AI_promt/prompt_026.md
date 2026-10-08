# PROMPT_026 — Mobile Group Chat UI & Realtime Messaging

## Context

GeoChat is a mobile + web application.

The backend Group Chat foundation was implemented in PROMPT_025.

Existing Mobile functionality includes:

- Authentication
- User Search
- Nearby Users
- Friends
- Direct Chat
- Realtime Direct Messaging
- Notifications
- Push Notifications
- Profile
- Settings
- Secure authentication state
- Existing WebSocket/STOMP infrastructure

PROMPT_025 added backend support for:

- Group conversations
- Group membership
- Owner/member roles
- Group creation
- Group information
- Group members
- Leave group
- Group text messages
- Group message history
- Group WebSocket messaging
- Group authorization

Now integrate Group Chat into the **existing Mobile application**.

---

# Goal

Implement a native-feeling Mobile Group Chat experience using the existing backend APIs and existing Chat/WebSocket architecture.

Users should be able to:

1. Create a group.
2. Select friends as initial members.
3. View their groups.
4. Open a group conversation.
5. View group information.
6. View group members.
7. Send text messages.
8. Receive realtime group messages.
9. Leave a group when they are a member.
10. Receive appropriate feedback for errors and unauthorized actions.

Do NOT modify the backend unless a genuine backend defect discovered during integration prevents the feature from working.

Do NOT create a second chat architecture.

---

# 1. Inspect Before Coding

Before modifying the Mobile application, inspect:

- existing project structure
- navigation
- authentication state
- API client
- API types
- Friends API
- existing Direct Chat screens
- conversation list
- Chat screen
- WebSocket/STOMP implementation
- message model
- notification handling
- reusable UI components
- existing loading/error/empty-state patterns

Also inspect the actual backend API contracts implemented in PROMPT_025.

Do not assume endpoint names from this prompt.

Use the actual backend implementation as the source of truth.

---

# 2. Fixed Technology Constraints

Keep the existing Mobile technology stack.

If the current project uses:

- React Native
- Expo
- TypeScript

continue using it.

Do NOT:

- replace React Native
- replace Expo
- introduce a new navigation framework
- introduce a large state-management framework
- create a second WebSocket library
- create a second API client

Reuse existing infrastructure.

---

# 3. Group List

Add Group Conversations to the existing conversation experience.

Prefer integrating groups into the existing conversation list rather than creating a completely separate chat system.

Each group item should display appropriate information such as:

- group name
- latest message if already available from backend
- latest message time if already available
- group/avatar placeholder if no avatar exists

Do not invent backend data.

If the existing conversation API does not yet return enough group metadata, use the actual group API appropriately.

Avoid making one API request per group when the backend already provides the required information.

---

# 4. Create Group

Add a user flow for creating a group.

Example navigation:

```text
Friends / Chats
      ↓
Create Group
```

The exact location should follow the existing Mobile navigation design.

The user should be able to:

1. Enter group name.
2. See their friends.
3. Select one or more friends.
4. Review selected members.
5. Create the group.

The authenticated user is automatically the group owner.

Do not allow the user to select themselves as a member.

---

# 5. Friend Selection

Reuse the existing Friends data/API.

Do not perform unnecessary duplicate API calls.

Each friend should have:

- display name
- username if available
- avatar if available
- selected/unselected state

Allow:

- selecting a friend
- deselecting a friend
- seeing selected member count

Respect the backend maximum group size.

Do not duplicate the maximum size as an unrelated hardcoded value if it can be obtained/configured from the existing application.

---

# 6. Group Creation Validation

Validate before submitting:

- group name is not empty
- group name does not exceed backend-supported length
- at least one other member is selected if required by backend rules

Show clear validation errors.

Prevent duplicate submissions while creation is in progress.

After successful creation:

- open the newly created group conversation
- update conversation/group state
- do not require an app restart

---

# 7. Group Chat Screen

Extend the existing Chat screen architecture to support:

```text
DIRECT
GROUP
```

Do not create a completely separate message UI if the existing Chat screen can be reused.

The group chat screen should display:

- group name
- messages
- sender identity for messages from other members
- message timestamp using existing formatting conventions
- message input
- send button

For the current milestone, text messages only.

---

# 8. Sender Display

Unlike direct chat, group messages must identify the sender.

For messages sent by the current user:

- use the existing current-user message style.

For messages from other users:

- display sender name where appropriate.

Avoid repeating the sender name excessively if the existing UI supports message grouping.

Keep the implementation simple.

Do not add message reactions or advanced message rendering.

---

# 9. Load Message History

Reuse the existing message-history API layer.

When opening a group:

1. Verify/authenticate the user.
2. Load existing messages.
3. Display loading state.
4. Display messages.
5. Display empty state if there are no messages.

A non-member should receive a proper authorization error from the backend.

The Mobile app must handle this gracefully.

---

# 10. Send Group Messages

Reuse the existing message-sending infrastructure.

The user should be able to send a text message.

Requirements:

- trim unnecessary whitespace
- reject empty messages
- disable send while appropriate
- handle sending errors
- clear the input after successful submission
- preserve existing chat behavior

Do not create a separate group-message API client if the existing chat API can handle both conversation types.

---

# 11. WebSocket Realtime Messaging

Reuse the existing WebSocket/STOMP infrastructure.

Do not create another WebSocket connection just for groups.

When entering a group conversation:

1. Connect/reuse the existing authenticated connection.
2. Subscribe to the actual conversation destination.
3. Receive group messages.
4. Render incoming messages.
5. Clean up the subscription when leaving the screen.

Use the same JWT authentication mechanism as existing direct chat.

---

# 12. WebSocket Authorization Errors

If the backend rejects a subscription or send operation:

- do not crash the application
- show a meaningful error
- navigate away if the user is no longer authorized to access the group

Do not attempt to bypass backend authorization.

The backend remains authoritative.

---

# 13. REST + WebSocket Deduplication

The existing direct-chat implementation already handles REST-created messages and WebSocket broadcasts.

Reuse the same strategy.

Every message should have a stable backend ID.

Do not deduplicate based only on:

- message text
- timestamp
- sender name

Verify that:

```text
REST message
+
WebSocket message
```

does not produce duplicate UI messages.

---

# 14. Reconnection

Reuse the existing reconnect behavior.

If the WebSocket disconnects:

- do not crash
- reconnect according to the existing strategy
- restore the group subscription
- avoid duplicate subscriptions

Do not create an entirely new reconnect manager.

---

# 15. Group Information

Add a simple Group Info screen or modal.

It should display:

- group name
- owner
- member count
- members

Use the backend group/member APIs.

Only display information actually returned by the backend.

Do not expose:

- internal IDs unnecessarily
- private user information
- security fields

---

# 16. Group Members

Display group members using the existing user/avatar UI patterns.

At minimum show:

- display name
- username if available
- role where appropriate

Owner should be visually identifiable.

Do not implement member administration in this milestone.

No:

- remove member
- promote member
- demote member
- ownership transfer

---

# 17. Leave Group

For a regular member, provide:

```text
Leave Group
```

Before leaving, show a confirmation dialog.

Example:

```text
Are you sure you want to leave this group?
```

After successful leave:

1. Remove the group from the local conversation/group state.
2. Disconnect/cleanup the group subscription.
3. Navigate back to the conversation list.
4. Show success feedback if the existing UX supports it.

If the current user is the owner:

- do not show a misleading leave action if the backend does not allow owners to leave.
- explain that ownership transfer is not currently supported if appropriate.

---

# 18. Notifications

Reuse the existing notification infrastructure.

If PROMPT_025 supports group-message notifications:

- display them using the existing notification UI
- navigate to the group conversation when tapped

If backend group-message notifications are not implemented:

- do not invent client-side fake notifications.

Do not create a new notification system.

---

# 19. Push Notifications

If the existing push notification infrastructure already supports the backend group notification type:

- integrate it using the existing mechanism.

Otherwise:

- do not implement a separate push architecture.

Push notification failures must never break group messaging.

---

# 20. Loading States

Add proper loading states for:

- group list
- friend selection
- group creation
- group information
- member list
- message history
- message sending
- leaving group

Prevent duplicate actions while requests are active.

Reuse existing Mobile loading components.

---

# 21. Empty States

Provide useful empty states.

Examples:

### No Groups

```text
You are not in any groups yet.
Create a group to start chatting.
```

### No Friends Available

```text
You don't have any friends to add yet.
```

### No Messages

```text
No messages yet.
Start the conversation.
```

Do not use fake/sample data.

---

# 22. Error Handling

Handle:

- network errors
- unauthorized access
- group not found
- invalid group name
- invalid member selection
- maximum member limit
- group creation failure
- message send failure
- WebSocket failure
- leave-group failure

Display understandable user-facing messages.

Do not expose raw backend stack traces.

---

# 23. Navigation Integration

Integrate groups into the existing Mobile navigation.

The expected flow should be approximately:

```text
Home
  ↓
Chats
  ↓
Create Group
  ↓
Group Chat
  ↓
Group Info
```

Follow the existing navigation architecture.

Do not create duplicate navigation stacks.

---

# 24. Authentication & Logout

Group Chat must respect the existing authentication state.

When the user logs out:

- group screen state is cleared appropriately
- WebSocket subscriptions are cleaned up
- authenticated API state is cleared
- navigation returns to Login

When the user logs in again:

- groups can be loaded normally
- realtime group messaging works again

---

# 25. State Management

Reuse the existing Mobile state architecture.

Do not introduce a new global store solely for groups.

Keep state ownership clear:

- authentication state → existing auth state
- conversations → existing chat state
- group-specific temporary form state → local screen state where appropriate
- WebSocket → existing realtime infrastructure

Avoid unnecessary duplication.

---

# 26. TypeScript Types

Create/update types based on the actual backend DTOs.

Examples conceptually:

```text
Group
GroupMember
CreateGroupRequest
GroupConversation
```

Do not blindly copy these names if the existing project follows another naming convention.

Keep API models centralized.

Avoid using `any` to bypass type errors.

---

# 27. Tests

Add tests using the existing Mobile testing setup.

At minimum cover:

### Create Group

- valid group creation
- empty group name
- no member selected
- duplicate selection handling
- successful navigation after creation

### Group Chat

- load group messages
- render sender name
- send message
- empty message rejected
- message deduplication

### Authorization

- unauthorized group access handled gracefully
- non-member error handled

### Leave

- confirmation shown
- successful leave
- owner cannot leave

### WebSocket

- group subscription
- incoming message
- cleanup
- reconnect behavior where existing test infrastructure supports it

Do not introduce a new testing framework.

---

# 28. Manual Verification

Use at least three accounts:

```text
User A = group owner
User B = group member
User C = non-member
```

### Create Group

1. Login as A.
2. Open Friends/Chats.
3. Create a group.
4. Add B.
5. Verify group is created.
6. Verify A is owner.
7. Verify B is a member.

### Group Chat

1. A opens the group.
2. B opens the group.
3. A sends a message.
4. B receives it realtime.
5. B replies.
6. A receives it realtime.
7. Verify no duplicate messages.

### Group Info

1. Open group info.
2. Verify A and B appear as members.
3. Verify owner is identified correctly.

### Non-member

1. Login as C.
2. Attempt to access the group.
3. Verify backend authorization prevents access.
4. Verify Mobile displays a proper error.

### Leave

1. Login as B.
2. Leave the group.
3. Verify B returns to conversation list.
4. Verify group is no longer available to B.
5. Verify A can still access the group.

### Logout

1. Logout.
2. Verify WebSocket subscriptions are cleaned up.
3. Login again.
4. Verify group functionality works again.

---

# 29. Build & Validation

Run:

```bash id="6wq1z0"
npx tsc --noEmit
```

Also run the existing Mobile test command if configured.

If the project has a build command, run it as well.

Fix all errors introduced by this prompt.

Do not ignore TypeScript errors.

---

# 30. Regression Check

Verify existing Mobile functionality still works:

- Login
- Register
- Home
- User Search
- Nearby Users
- Friends
- Direct Chat
- Direct WebSocket messaging
- Notifications
- Push Notifications
- Profile
- Settings
- Logout

Direct Chat must continue working exactly as before.

Do not regress direct conversations while adding Group Chat.

---

# 31. Scope Protection

This prompt is ONLY for:

- Mobile Group list integration
- Mobile Group creation
- Friend selection
- Mobile Group Chat
- Group message history
- Group realtime messaging
- Group Info
- Group Members
- Leave Group
- Existing notification integration
- Existing push integration where supported
- Tests
- TypeScript/build validation

Do NOT implement:

- Web Group Chat
- Group avatar upload
- Media messages
- File sharing
- Message reactions
- Typing indicators
- Read receipts
- Message editing
- Message deletion
- Member removal
- Role management
- Ownership transfer
- Invite links
- Public groups
- Group discovery
- Location sharing
- Map integration
- New WebSocket architecture
- New state-management framework

These belong to future milestones.

---

# 32. Final Report

When finished, report:

1. Files changed.
2. Routes/screens added.
3. API endpoints actually used.
4. Group creation flow.
5. Group chat integration.
6. WebSocket integration.
7. Group Info/member behavior.
8. Leave-group behavior.
9. Notification/push behavior.
10. Tests added/updated.
11. TypeScript result.
12. Build result.
13. Manual verification result using A/B/C.
14. Regression result for Direct Chat.
15. Known limitations.
16. Future work identified but NOT implemented.

Clearly classify issues as:

```text
Fixed
Not Applicable
Known Limitation
Future Work
```

At the very end, use exactly one:

```text
PROMPT_026 COMPLETE
```

or:

```text
PROMPT_026 NOT COMPLETE
```

Only report `PROMPT_026 COMPLETE` when the Mobile Group Chat integration, realtime messaging, authorization handling, tests, and validation have actually been completed.