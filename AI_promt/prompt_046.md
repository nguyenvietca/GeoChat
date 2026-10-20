# PROMPT_046 — GeoChat Admin Foundation & User Management

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot, Spring Security, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS, Flyway.
- Authentication: GeoChat JWT with email/password, Google and Facebook login.
- Web: React, TypeScript, Vite.
- Realtime: WebSocket/STOMP.
- Deployment: Docker Compose and Nginx.
- Architecture: Modular monolith.
- Development environment: Windows.

Confirmed progress:
- PROMPT_043 — Google Login & Account Linking: user-accepted.
- PROMPT_044 — Facebook Login & Account Linking: COMPLETE.
- PROMPT_045 — Phone Login & SMS OTP: DEFERRED due to SMS provider costs.
- PROMPT_046 — Current milestone.

Important: PROMPT_042 release verification still has outstanding checks. Do not claim the application is production-ready.

The repository is the source of truth.

## 2. Objective

Build the first secure, usable Admin module for GeoChat.

Deliver:
1. Role-based Admin authorization.
2. Protected Admin Web routes.
3. Admin application layout.
4. User list with server-side search, filtering and pagination.
5. Read-only user details.
6. Account suspension and reactivation.
7. Audit logs for sensitive administrative actions.
8. Basic dashboard statistics.
9. Security tests and documentation.

Do not implement geographic analytics yet. That belongs to PROMPT_047.

## 3. Mandatory Audit Before Coding

Inspect:
- Existing User entity and account status model.
- Existing roles, authorities and Spring Security rules.
- JWT generation and authorization.
- Existing account suspension/disable logic.
- Google and Facebook account linking.
- Existing API response conventions.
- Existing Web routing and layouts.
- Existing table, modal, pagination and form components.
- Flyway migration history.
- Existing test infrastructure.
- Existing audit/event logging.

Classify requirements as:
- ALREADY IMPLEMENTED.
- REUSABLE.
- NEEDS EXTENSION.
- MISSING.

Do not duplicate implemented functionality.

Present a concise implementation plan before making changes.

## 4. Scope Restrictions

Allowed:
- Backend Admin APIs.
- Admin-specific authorization.
- Minimal database changes.
- Web Admin pages and components.
- Admin audit logs.
- Automated tests.
- Documentation.

Not allowed:
- SMS OTP.
- Geographic heatmaps.
- GPS tracking.
- Advanced analytics.
- Advertising analytics.
- Reading private chat messages.
- Mass messaging.
- Bulk user deletion.
- Complex moderation/reporting workflows.
- New authentication providers.
- Major frontend redesign.
- Unrelated infrastructure changes.

Mobile is paused:
- Do not modify Mobile source.
- Do not build Mobile.
- Do not typecheck Mobile.
- Do not test Mobile.
- Preserve existing Mobile-facing APIs.

---

# PART A — ADMIN SECURITY

## 5. Role-Based Authorization

Reuse the existing authorization model if suitable.

Otherwise introduce the minimum required Admin authority, for example ROLE_ADMIN.

Requirements:
- Ordinary users cannot access Admin APIs.
- Ordinary users cannot access Admin Web routes.
- Backend must enforce authorization independently of Web.
- Admin authorization must be validated on every protected request.
- Deny access by default.
- Do not trust roles supplied by the browser.

Prefer standard Spring Security method/request authorization.

Do not implement authorization using only frontend checks.

## 6. Admin Privilege Provisioning

Do not allow public registration to create an Admin account.

Do not add an endpoint that lets ordinary users promote themselves.

Provide a secure, documented initial Admin provisioning procedure.

Preferred approach:
- Use an explicit operator-controlled command or narrowly scoped provisioning mechanism.
- Require a specific existing user identity.
- Verify the target user exists.
- Require intentional operator confirmation.
- Make the operation idempotent.
- Record the privilege grant in an audit record.

Do not automatically grant Admin to:
- The first registered user.
- A user with a particular email domain.
- A user with a hardcoded email address.
- A Google or Facebook account merely because of its provider.

Do not commit bootstrap Admin credentials.

## 7. JWT and Role Changes

Review how JWT currently stores roles or authorities.

If roles are embedded in JWT:
- Avoid relying solely on stale role claims for sensitive Admin operations.
- Ensure Admin revocation becomes effective promptly.
- Consider loading current authorities from trusted server-side state for Admin API authorization.
- Preserve existing JWT compatibility where possible.

Document how a revoked Admin loses access.

Do not require a complete JWT architecture rewrite.

## 8. Protect Admin Accounts

Requirements:
- Admin users cannot accidentally suspend themselves.
- Admin users cannot remove their own last Admin privilege.
- The system must not allow the final active Admin account to be disabled through ordinary Admin APIs.
- Ordinary users cannot modify Admin status.
- Privileged actions must be audited.
- Apply existing rate limiting where appropriate.

For the initial milestone, do not provide a public role-management UI.

Admin role grants and revocations should remain operator-controlled unless a secure workflow already exists.

## 9. Authentication Providers

Preserve:
- Email/password authentication.
- Google Login.
- Facebook Login.
- Existing account linking.
- Existing account unlinking.

An Admin may authenticate using an existing linked provider, but authorization must depend on the internal GeoChat user and trusted role assignments, not provider email or display name.

---

# PART B — ADMIN API

## 10. API Namespace

Use the repository's established API conventions.

Suggested namespace:

/api/v1/admin

Do not duplicate existing routes.

Protect all endpoints using Backend authorization.

Return appropriate:
- 200 for successful reads/actions.
- 400 for invalid input.
- 401 for unauthenticated requests.
- 403 for unauthorized requests.
- 404 when appropriate.
- 409 for state conflicts.
- 429 for rate limiting.

Use existing error response conventions.

## 11. User List API

Implement a paginated user management endpoint.

Conceptual example:

GET /api/v1/admin/users

Supported filters:
- Search by username or email.
- Account status.
- Authentication provider, if practical.
- Registration date range, if existing data supports it.

Requirements:
- Server-side pagination.
- Bounded page size.
- Deterministic sorting.
- Indexed queries where justified.
- No unbounded full-table reads.
- Parameterized queries.
- No sensitive credential fields in responses.

Avoid N+1 queries.

## 12. User List Fields

Return only necessary information:
- Internal user ID.
- Display name.
- Username.
- Email where available.
- Account status.
- Registration timestamp.
- Last login timestamp if already recorded reliably.
- Linked provider names, if needed.

Do not return:
- Password hashes.
- JWTs.
- OAuth access tokens.
- OAuth refresh tokens.
- Session secrets.
- Precise GPS coordinates.
- Private chat content.

## 13. User Detail API

Provide a read-only user detail endpoint.

Conceptual example:

GET /api/v1/admin/users/{userId}

Show:
- Basic profile information.
- Account status.
- Registration date.
- Last login if available.
- Linked authentication providers.
- Suspension reason/status if applicable.
- Relevant account moderation history.

Do not expose:
- Password hashes.
- Provider secrets.
- Private messages.
- Private location history.

Use a dedicated Admin DTO instead of serializing the entire User entity.

## 14. Account Suspension

Implement account suspension using the existing account status model when possible.

Conceptual action:

POST /api/v1/admin/users/{userId}/suspend

Request:
- Reason.

Requirements:
- Admin-only.
- Reason required with sensible length validation.
- Idempotent or conflict-safe state transitions.
- Prevent self-suspension.
- Prevent suspension of the last active Admin.
- Record actor, target, reason and timestamp.
- Do not delete user data.
- Do not delete messages, friends or groups.

A suspended user must not be able to obtain new sessions through:
- Password login.
- Google Login.
- Facebook Login.

## 15. Existing Sessions and Realtime Access

Review whether suspended users can continue using previously issued JWTs.

Security requirement:
Suspension must become effective promptly for authenticated APIs, not merely block the next login.

Ensure:
- Existing JWT-based API access is denied after suspension.
- WebSocket connection establishment is denied for suspended users.
- Existing active WebSocket sessions are invalidated or have a clearly bounded and documented enforcement delay.
- Message sending and other sensitive realtime operations cannot bypass suspension.

Reuse existing account-status validation mechanisms.

Do not introduce expensive database lookups for every message without evaluating performance.

If a secure immediate-revocation mechanism is not available, implement a reasonable bounded solution and clearly document its guarantees.

## 16. Account Reactivation

Conceptual action:

POST /api/v1/admin/users/{userId}/reactivate

Requirements:
- Admin-only.
- Valid state transition.
- Audit record.
- Preserve original account identity.
- Preserve all associated user data.
- Do not automatically reset passwords.
- Do not automatically change linked providers.

## 17. Concurrent Admin Actions

Handle:
- Two Admins suspending the same user.
- Reactivation racing with suspension.
- Repeated requests.
- Account status changes during an action.

Use transactions and optimistic locking or equivalent safeguards where appropriate.

Return meaningful conflict responses.

---

# PART C — ADMIN AUDIT LOGS

## 18. Audit Requirements

Record security-sensitive administrative operations.

Minimum events:
- Admin privilege grant/revocation performed through operator provisioning, where implemented.
- User suspension.
- User reactivation.
- Failed privileged mutation attempts when useful and safe.

Recommended fields:
- Audit ID.
- Actor user ID.
- Target user ID.
- Action type.
- Timestamp.
- Reason.
- Previous status.
- New status.
- Correlation/request ID when available.

Do not store:
- Passwords.
- JWTs.
- OAuth tokens.
- Raw authentication headers.
- Unnecessary personal data.

## 19. Audit Persistence

Reuse an existing audit infrastructure if present.

Otherwise add a minimal append-only Admin audit table.

Use Flyway.

Do not modify applied migrations.

Ensure a successful administrative state change and its audit record are committed consistently.

Audit records should not be editable through normal Admin APIs.

## 20. Audit Log Viewer

Provide a simple read-only, paginated Admin audit history.

Conceptual endpoint:

GET /api/v1/admin/audit-logs

Allow basic filtering by:
- Action.
- Actor.
- Target.
- Date range.

Do not implement a full observability platform.

---

# PART D — ADMIN WEB

## 21. Protected Admin Routes

Add an Admin section to the existing React Web application.

Suggested routes:

/admin
/admin/users
/admin/users/:userId
/admin/audit-logs

Follow existing routing conventions.

Requirements:
- Admin-only access.
- Safe redirect or 403 page for non-Admin users.
- Session expiry handling.
- No unauthorized data rendered before permission verification.
- Backend remains the authorization authority.

## 22. Admin Layout

Create a clean, practical layout.

Suggested sidebar:
- Overview.
- Users.
- Audit Logs.
- Back to GeoChat.

Header:
- Current Admin identity.
- Navigation.
- Theme support.
- Logout or existing account menu.

Requirements:
- Desktop responsive.
- Tablet responsive.
- Mobile Web responsive.
- Keyboard accessible.
- Visible focus indicators.
- Light/Dark theme compatibility.

Do not redesign the entire GeoChat application.

## 23. Overview Dashboard

Implement a basic Admin overview.

Suggested cards:
- Total registered users.
- New users in the last 7 days.
- Active accounts.
- Suspended accounts.

Use real database values.

Do not invent statistics.

Define the exact meaning of each metric.

Do not implement:
- Geographic heatmap.
- DAU/MAU event tracking.
- Visit-location analytics.
- Real-time geolocation dashboard.

These belong to PROMPT_047.

## 24. Users Page

Create a practical user management table.

Columns:
- User.
- Email.
- Status.
- Registered date.
- Last login if available.
- Actions.

Features:
- Search.
- Status filter.
- Pagination.
- Loading state.
- Empty state.
- Error state.
- Retry.
- View details.

Use server-side pagination.

Do not load all users into the browser.

## 25. User Detail Page

Show:
- Basic profile.
- Account status.
- Linked providers.
- Registration information.
- Recent moderation actions.

Provide:
- Suspend action when allowed.
- Reactivate action when allowed.

Do not show private conversations.

## 26. Suspension Confirmation

Before suspension, show a confirmation dialog containing:
- Target username.
- Reason input.
- Explanation of the effect.
- Confirm and Cancel actions.

Do not allow an empty reason.

Prevent accidental double submission.

Show success/failure feedback.

## 27. Audit Log Page

Show a paginated table:
- Time.
- Admin actor.
- Action.
- Target.
- Reason or short details.

Support useful filtering.

Do not display raw internal JSON dumps as the main UI.

## 28. UX Quality

Ensure:
- No layout flicker.
- No unnecessary page reloads.
- No duplicate toast notifications.
- Stable pagination.
- Clear permission errors.
- Accessible dialogs.
- Responsive tables.
- Sensible loading placeholders.

Reuse existing design components.

---

# PART E — DATABASE & PERFORMANCE

## 29. Minimal Schema Changes

Add only necessary:
- Role/authority persistence.
- Account status fields, if missing.
- Admin audit table.
- Supporting indexes.

Reuse existing schema where possible.

Do not create duplicate role or status columns.

Do not delete or reset user data.

## 30. Database Queries

Optimize for:
- Paginated user list.
- Search by username/email.
- Account status filters.
- Basic statistics.
- Audit log pagination.

Avoid:
- Full user entity hydration when DTO projections suffice.
- Unbounded queries.
- N+1 provider identity lookups.
- Excessive database round trips.

Add indexes only when justified by query patterns.

---

# PART F — TESTING

## 31. Backend Security Tests

Test at minimum:
1. Unauthenticated user cannot access Admin APIs.
2. Normal user receives 403.
3. Admin can list users.
4. Admin can view user details.
5. Admin can suspend an eligible user.
6. Admin can reactivate a suspended user.
7. Normal user cannot suspend accounts.
8. Admin cannot suspend self.
9. Last active Admin cannot be disabled.
10. Suspended user cannot log in with password.
11. Suspended user cannot log in with Google.
12. Suspended user cannot log in with Facebook.
13. Existing JWT access is rejected after suspension.
14. WebSocket authentication and message sending respect suspension.
15. Suspension action creates an audit record.
16. Reactivation creates an audit record.
17. Pagination enforces maximum page size.
18. Search is parameterized and safe.
19. Admin DTOs do not expose secrets.
20. Concurrent moderation actions are handled safely.
21. Revoked Admin authorization is enforced promptly.

Mock external OAuth providers in automated tests.

## 32. Web Tests

Test:
- Admin route guard.
- Normal user forbidden state.
- Dashboard loading and error states.
- User search.
- Pagination.
- User detail.
- Suspension confirmation.
- Reason validation.
- Reactivation.
- Audit log rendering.
- Session expiry.
- Responsive layout where feasible.

## 33. Regression Tests

Verify:
- Password login.
- Google Login.
- Facebook Login.
- Account linking.
- Direct chat.
- Group chat.
- Friends.
- Nearby.
- Notifications.
- WebSocket connectivity.

Do not reimplement existing features.

## 34. Build Validation

Run:
- Backend Maven Wrapper compile/tests.
- Web tests.
- Web TypeScript checks.
- Web production build.
- Lint where configured.

Do not build or test Mobile.

## 35. Docker Validation

If Docker is available:
- Validate Compose configuration.
- Build affected services.
- Verify Flyway migrations.
- Test Admin login and authorization.
- Test user suspension with two test accounts.

Use disposable test accounts and environments.

Never suspend real users during testing.

Never delete persistent Docker volumes.

If Docker is unavailable, report BLOCKED.

---

# PART G — DOCUMENTATION

## 36. Admin Setup Guide

Create or update documentation covering:
- Admin authorization model.
- How to provision the first Admin securely.
- How to revoke Admin access.
- Admin API overview.
- User suspension behavior.
- Existing JWT and WebSocket session handling.
- Audit log fields.
- Local testing.
- Known limitations.

Include Windows PowerShell-compatible commands where relevant.

Do not include real credentials.

## 37. Operational Safety

Document:
- How to recover from accidentally suspended test accounts.
- How to ensure at least one active Admin remains.
- How to audit administrative actions.
- How to revoke a compromised Admin account.

Do not provide public Admin registration.

---

# PART H — IMPLEMENTATION PLAN

## 38. Phase 1 — Audit

Inspect repository and identify reusable components.

## 39. Phase 2 — Authorization

Implement Admin role enforcement and secure provisioning.

## 40. Phase 3 — Admin Backend

Implement user list, detail, suspension, reactivation, audit logs and basic statistics.

## 41. Phase 4 — Admin Web

Implement protected routes, layout, overview, users and audit log pages.

## 42. Phase 5 — Security & Regression

Validate role restrictions, suspended sessions, existing login providers and realtime behavior.

## 43. Phase 6 — Documentation

Document Admin setup, security guarantees and known limitations.

---

# PART I — ACCEPTANCE CRITERIA

## 44. Completion Checklist

- [ ] Repository audited before changes.
- [ ] Existing authorization reused where possible.
- [ ] Admin role enforced by Backend.
- [ ] Public Admin registration is impossible.
- [ ] Initial Admin provisioning is secure and documented.
- [ ] Revoked Admin privileges stop granting access promptly.
- [ ] Protected Admin Web routes work.
- [ ] Admin overview displays real database statistics.
- [ ] User list supports server-side pagination.
- [ ] Search and status filtering work.
- [ ] User details exclude sensitive secrets.
- [ ] Admin can suspend eligible accounts.
- [ ] Admin can reactivate suspended accounts.
- [ ] Self-suspension is prevented.
- [ ] Last active Admin is protected.
- [ ] Suspended users cannot obtain new sessions.
- [ ] Existing sessions are invalidated or reliably denied within a documented bound.
- [ ] Realtime messaging cannot bypass suspension.
- [ ] Sensitive Admin actions are audited.
- [ ] Audit history is readable and paginated.
- [ ] Google Login remains functional.
- [ ] Facebook Login remains functional.
- [ ] Password login remains functional.
- [ ] Existing GeoChat functionality remains compatible.
- [ ] Flyway migrations are safe.
- [ ] Backend tests pass.
- [ ] Web tests/build pass.
- [ ] Mobile source remains unchanged.
- [ ] No private chat or precise location data is exposed in Admin.
- [ ] Geographic analytics is deferred to PROMPT_047.
- [ ] Outstanding release verification blockers remain documented.

## 45. Final Report

Provide a Vietnamese implementation report with:

1. Audit findings.
2. Reused components.
3. Authorization design.
4. Admin provisioning procedure.
5. Backend endpoints.
6. Admin UI pages.
7. User suspension/reactivation behavior.
8. Existing session and WebSocket enforcement.
9. Audit log implementation.
10. Basic statistics.
11. Database migrations.
12. Files created.
13. Files modified.
14. Backend test results.
15. Web test/build results.
16. Docker validation results.
17. Security findings.
18. Compatibility with Google/Facebook login.
19. Mobile unchanged confirmation.
20. Known limitations.
21. Remaining PROMPT_042 release verification blockers.
22. Recommended next milestone.

End with exactly one:

PROMPT_046 COMPLETE

or

PROMPT_046 NOT COMPLETE

Only report COMPLETE when the scoped implementation and required automated validation have passed without unresolved Critical/High security issues.

Do not claim production readiness without the outstanding release checks.