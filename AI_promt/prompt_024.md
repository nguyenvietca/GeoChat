# PROMPT_024 — UX Polish & Production Readiness

## Context

GeoChat is a mobile + web application with a Spring Boot backend.

The core application is now implemented and has completed:

- Authentication
- User profile
- User search
- Current location
- Nearby users
- Friend requests
- Friends
- Direct chat
- WebSocket realtime messaging
- Notifications
- Mobile push notifications
- Web Profile & Settings
- WebSocket security
- Authorization/security hardening
- End-to-end integration review

PROMPT_023 completed the integration and security hardening phase.

The goal of this prompt is to improve the existing product quality and operational readiness without introducing major new features.

---

# Goal

Polish the existing GeoChat application so that:

- UI behavior is consistent
- loading states are clear
- empty states are understandable
- errors are user-friendly
- forms provide useful validation
- realtime reconnect behavior is stable
- responsive behavior is acceptable
- environment configuration is clean
- production-sensitive configuration is reviewed
- logs are useful but safe
- build/test/typecheck are reproducible
- the application feels like a coherent product rather than a collection of completed milestones

Do not redesign the entire application.

Do not add new product features.

---

# 1. Inspect Before Coding

Before modifying anything:

Inspect the current:

### Backend

- configuration
- environment variables
- logging
- exception handling
- CORS
- security configuration
- WebSocket configuration
- database configuration
- Flyway configuration
- health endpoint
- build configuration

### Web

- global layout
- navigation
- pages
- API client
- authentication state
- WebSocket handling
- notifications
- error handling
- responsive styles
- reusable components

### Mobile

- navigation
- screens
- API client
- authentication state
- WebSocket handling
- push notification handling
- loading/error states
- reusable components
- platform-specific behavior

Use the existing implementation as the source of truth.

Do not rewrite working architecture just for stylistic reasons.

---

# 2. UI Consistency Review

Review existing Web and Mobile screens for inconsistent behavior.

At minimum review:

- Login
- Register
- Home
- User Search
- Nearby Users
- Friends
- Chat
- Notifications
- Profile
- Settings

Use consistent patterns for:

- page/screen titles
- buttons
- forms
- spacing
- loading indicators
- error messages
- empty states
- success messages
- disabled states

Reuse existing components where possible.

If a reusable component already exists, use it instead of duplicating markup.

---

# 3. Loading States

Every asynchronous user-facing operation should have an understandable loading state.

Review:

### Authentication

- login
- register
- logout

### Search

- user search
- nearby search

### Friends

- loading friend list
- sending request
- accepting request
- rejecting request
- cancelling request

### Chat

- loading conversations
- loading messages
- sending message

### Notifications

- loading notifications
- marking read
- marking all read

### Profile

- loading profile
- updating profile
- changing password if supported

Prevent duplicate submissions where appropriate.

Do not leave buttons apparently unresponsive while requests are running.

---

# 4. Empty States

Add or improve meaningful empty states.

Examples:

### Search

"No users found."

### Nearby

"No nearby users found."

### Friends

"You don't have any friends yet."

### Friend Requests

"No pending friend requests."

### Conversations

"No conversations yet."

### Messages

"No messages yet."

### Notifications

"You're all caught up."

Empty states should be visually clear but simple.

Do not add fake sample data.

---

# 5. Error States

Review all major screens for error handling.

Errors should:

- be understandable
- not expose stack traces
- not expose raw SQL/database errors
- not expose JWT information
- provide a retry action when appropriate
- preserve already-loaded data when possible

Example:

```text
Unable to load notifications.
Try again.
```

Avoid generic errors such as:

```text
Error
Something went wrong!!!
```

when a more useful message is possible.

---

# 6. Network Failure Handling

Test behavior when the backend is temporarily unavailable.

Verify:

- existing data is not unnecessarily destroyed
- loading indicators stop
- an error is displayed
- retry works
- application does not crash

For Mobile, verify behavior when:

- Wi-Fi is disconnected
- mobile network changes
- backend is unavailable

For Web, verify behavior when:

- API request fails
- WebSocket disconnects

Do not attempt to build a full offline-first architecture.

---

# 7. WebSocket UX

Review existing Web and Mobile realtime behavior.

Verify:

### Connection

User can connect after login.

### Reconnect

Temporary disconnect does not permanently break realtime functionality.

### Duplicate subscriptions

Navigating between screens does not create duplicate subscriptions.

### Logout

Realtime subscriptions are cleaned up.

### Login again

Realtime functionality can initialize again.

### Failure

WebSocket failure does not crash the application.

If the UI exposes connection status, keep it subtle and understandable.

Do not create a complicated realtime state machine unless the existing implementation genuinely requires it.

---

# 8. Chat UX Polish

Improve the existing direct chat experience without adding new chat features.

Review:

- message loading
- message sending
- disabled send button when message is invalid
- empty message handling
- message list scrolling
- newest message visibility
- duplicate message prevention
- reconnect behavior
- error feedback

Do not add:

- group chat
- media
- file upload
- reactions
- typing indicators
- read receipts

---

# 9. Notification UX Polish

Review notifications on Web and Mobile.

Verify:

- unread count is accurate
- read state is visually obvious
- mark-as-read works
- mark-all-as-read works
- realtime notifications appear without refresh
- duplicate notifications do not appear
- notification navigation works
- notification list remains usable after reconnect

Do not add new notification types.

Do not implement browser push notifications in this prompt.

---

# 10. Form Validation UX

Review:

- Login
- Register
- Edit Profile
- Password Change, if supported
- Search
- Chat message input

Validation should happen before unnecessary API calls when possible.

Use clear messages such as:

```text
Username is required.
Password must be at least ...
Please enter a valid email address.
Message cannot be empty.
```

Do not duplicate backend business rules incorrectly.

Frontend validation is only for UX; backend validation remains authoritative.

---

# 11. Button & Interaction States

Review interactive controls.

Buttons should correctly represent:

- normal
- hover/focus where applicable
- disabled
- loading
- success/error where appropriate

Prevent accidental double-click actions.

Examples:

- sending two identical friend requests
- submitting a form twice
- sending the same chat message twice
- marking notifications repeatedly

Do not disable controls unnecessarily.

---

# 12. Responsive Web Review

Test the Web application at:

- desktop width
- tablet width
- mobile browser width

Review:

- navigation
- search
- nearby users
- friends
- chat
- notifications
- profile
- settings

Ensure:

- no major horizontal overflow
- buttons remain usable
- text does not overlap
- chat input remains accessible
- notification badge does not break layout
- navigation remains usable

Do not redesign the entire UI.

Fix only issues discovered during the review.

---

# 13. Mobile UI Review

Review the mobile application on an actual emulator/device if available.

Check:

- keyboard behavior
- safe-area handling
- scrolling
- navigation
- loading states
- error messages
- forms
- chat input
- notification navigation
- logout
- location permission flow

Do not introduce unnecessary platform-specific complexity.

---

# 14. Accessibility Basics

Improve obvious accessibility problems.

Web:

- buttons should have understandable labels
- inputs should have labels
- interactive elements should be keyboard accessible
- focus should be visible
- images should have appropriate alternative text where relevant

Mobile:

- buttons should have meaningful accessibility labels where necessary
- touch targets should remain usable
- important information should not rely only on color

Do not attempt a complete WCAG audit.

Focus on obvious issues introduced by the current UI.

---

# 15. Backend Error & Health Behavior

Review backend operational behavior.

Verify:

- global exception handling works
- expected API errors have appropriate HTTP status codes
- unexpected errors do not expose internal details
- useful errors are logged server-side
- sensitive data is not logged

Review the existing health endpoint.

If the project already has a health endpoint, ensure it still works.

Do not introduce a complete observability stack.

---

# 16. Configuration Cleanup

Review configuration files.

Check:

```text
application.yml
application.properties
.env
.env.example
Web environment configuration
Mobile environment configuration
Docker configuration
```

Ensure:

- secrets are not committed
- example values are clearly placeholders
- development configuration is understandable
- production-sensitive values come from environment/configuration
- API base URLs are configurable
- WebSocket URLs are configurable
- database configuration is configurable
- JWT configuration is configurable

Do not hardcode machine-specific paths.

Do not hardcode the developer's local IP address.

---

# 17. Production-Sensitive Defaults

Review for dangerous defaults.

Examples:

- weak JWT secret
- default database password
- permissive CORS
- debug logging
- stack traces exposed to clients
- development-only credentials
- unrestricted WebSocket access

Fix unsafe defaults where appropriate.

Do not break local development.

If development and production require different settings, separate them using configuration/environment variables.

---

# 18. Database & Migration Readiness

Review Flyway migrations.

Ensure:

- migrations are ordered correctly
- migrations are reproducible
- no migration depends on a developer's local database state
- schema changes are tracked
- application startup does not require manually modifying the database

Do not rewrite existing migrations that have already been applied unless absolutely necessary.

If a schema correction is required, create a new migration.

---

# 19. Logging & Debug Output

Search Web, Mobile, and Backend for accidental development logging.

Remove or reduce unnecessary:

```text
console.log(...)
console.error(...)
System.out.println(...)
```

where they expose:

- tokens
- passwords
- password hashes
- private location data
- sensitive user information

Keep useful error logging.

Do not remove all logs.

---

# 20. Dependency Review

Inspect dependencies for obvious unnecessary additions.

Do not perform a major dependency upgrade in this prompt.

Only:

- remove clearly unused dependencies if safe
- fix obvious incompatible versions if required
- verify the project builds with the existing versions

Do not upgrade the entire technology stack.

The current backend baseline remains:

- Java 21
- Spring Boot 4.1.0
- Maven Wrapper
- PostgreSQL
- PostGIS
- Flyway
- JWT

---

# 21. Environment Reproducibility

Verify a new developer can understand how to start the project.

Review existing documentation.

At minimum document:

### Backend

- required Java version
- Maven Wrapper usage
- required environment variables
- PostgreSQL/PostGIS requirement
- database setup

### Web

- Node.js requirement if already defined
- install command
- environment variables
- development command
- build command

### Mobile

- Node.js requirement if already defined
- install command
- environment variables
- emulator/device requirements
- development command

Do not create a huge documentation system.

Update the existing README/docs structure.

---

# 22. Docker / Local Development

If Docker configuration already exists:

Review:

- PostgreSQL
- PostGIS
- backend
- required environment variables
- ports
- volumes

Verify it does not contain machine-specific configuration.

Do not turn the project into a full production Docker/Kubernetes deployment.

If Docker is currently broken, fix only issues directly related to the GeoChat development setup.

Do not spend this milestone redesigning Docker Desktop/WSL infrastructure.

---

# 23. Build Validation

Run all available validation commands.

Backend:

```bash
.\mvnw.cmd test
```

Web:

```bash
npm run build
```

Mobile:

```bash
npx tsc --noEmit
```

Also run configured tests/lint commands if they already exist.

No new linting framework is required.

---

# 24. Manual Smoke Test

Perform a complete smoke test.

### Authentication

- Register
- Login
- Restore session
- Logout

### Users

- Search
- View profile
- Update profile

### Location

- Update current location
- Nearby search

### Friends

- Send request
- Accept request
- Reject request
- Cancel request
- View friend list

### Chat

- Open conversation
- Load history
- Send message
- Receive realtime message
- Verify no duplicate messages

### Notifications

- Receive notification
- View notification
- Mark read
- Mark all read
- Verify realtime notification

### Settings

- Open settings
- Change password if supported
- Logout

Verify the same core flows on both Web and Mobile where the feature exists.

---

# 25. Regression Protection

After polishing, verify that no existing functionality was broken.

Regression checklist:

- Authentication
- JWT authorization
- User Search
- Current Location
- Nearby Users
- Friends
- Direct Chat
- WebSocket messaging
- Notifications
- Push Notifications
- Profile
- Settings
- Logout

If a change breaks an existing feature, fix the regression before declaring completion.

---

# 26. Scope Protection

This prompt is ONLY for:

- UX consistency
- loading states
- empty states
- error handling
- form validation UX
- responsive improvements
- accessibility basics
- WebSocket UX stability
- chat UX polish
- notification UX polish
- configuration cleanup
- logging cleanup
- development documentation
- local development readiness
- build/test/typecheck validation
- regression testing

Do NOT implement:

- Group Chat
- Map UI
- Media/File Sharing
- Reactions
- Typing Indicators
- Read Receipts
- Advanced Search
- Location History
- Location Tracking
- New Social Features
- New Notification Types
- New Authentication Providers
- Account Deletion
- 2FA
- Major UI redesign
- Microservices migration
- Kubernetes
- Full CI/CD pipeline
- Full observability stack
- Major dependency upgrades

If you discover a feature request during this work, document it as future work instead of implementing it.

---

# 27. Final Report

When finished, report:

1. UX issues found.
2. UX issues fixed.
3. Loading/empty/error states improved.
4. Responsive issues fixed.
5. Accessibility improvements.
6. WebSocket/realtime UX improvements.
7. Configuration changes.
8. Logging changes.
9. Documentation changes.
10. Docker/local-development changes, if any.
11. Tests added/updated.
12. Backend test result.
13. Web build/typecheck result.
14. Mobile typecheck/test result.
15. Manual smoke-test result.
16. Regressions found/fixed.
17. Known limitations.
18. Suggested future features, without implementing them.

Clearly classify remaining issues as:

```text
Fixed
Not Applicable
Known Limitation
Future Work
```

At the very end, use exactly one:

```text
PROMPT_024 COMPLETE
```

or:

```text
PROMPT_024 NOT COMPLETE
```

Only report `PROMPT_024 COMPLETE` when all applicable requirements have been implemented and validated.