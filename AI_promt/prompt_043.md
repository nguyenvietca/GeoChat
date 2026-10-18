# PROMPT_043 — GeoChat Google Login & Secure Account Linking

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS.
- Database migrations: Flyway.
- Authentication: Existing JWT authentication.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Deployment: Docker Compose with Nginx reverse proxy.
- Architecture: Modular monolith.
- Development environment: Windows.
- Mobile: Development paused.

Confirmed completed milestones:
- PROMPT_036 — Nearby Discovery & Map UX.
- PROMPT_037 — Friend Discovery & Connection UX.
- PROMPT_038 — Chat Performance & Pagination.
- PROMPT_039 — Notifications & Realtime UX.
- PROMPT_040 — Security & Production Readiness.
- PROMPT_041 — Deployment & Monitoring Foundation.
- PROMPT_042 — Release Verification & Reliability implementation.

IMPORTANT:
PROMPT_042 completion does not mean GeoChat is release-ready. Some Docker/security scan, GitHub CI and UI smoke verification items remain pending.

The repository is the source of truth.

## 2. Primary Objective

Implement secure Google authentication for GeoChat Web using OAuth 2.0 and OpenID Connect.

Users should be able to:

1. Sign in with Google.
2. Create a GeoChat account through Google on first login.
3. Continue using the existing GeoChat account and data.
4. Securely link Google to an existing authenticated account.
5. View linked authentication providers.
6. Unlink Google when another usable sign-in method remains.
7. Continue using the existing JWT-based GeoChat API and WebSocket authentication.

Do not replace GeoChat JWT with Google tokens.

Do not automatically merge accounts solely because their email addresses match.

---

# PART A — MANDATORY RULES

## 3. Audit First, Implement Second

Before changing code, inspect:

Backend:
- Existing authentication controllers.
- Login and registration services.
- JWT generation and validation.
- Spring Security configuration.
- User entity and repositories.
- Password hashing.
- Existing account status rules.
- Existing user email constraints.
- Flyway migrations.
- Existing auth-related tests.
- Existing exception handling.
- Existing rate limiting.

Web:
- Login page.
- Registration page.
- Authentication context/store.
- API client.
- JWT persistence.
- Protected routes.
- Logout behavior.
- Existing account/profile settings.
- Existing toast/error handling.
- Existing responsive styles.

Infrastructure:
- application-prod.yml.
- Existing environment templates.
- Docker Compose.
- Nginx configuration.
- GitHub Actions.

Classify requirements:
- ALREADY IMPLEMENTED.
- NEEDS IMPROVEMENT.
- MISSING.
- NOT APPLICABLE.

Do not recreate existing authentication infrastructure.

Produce a concise audit summary before implementation.

## 4. Scope

Allowed:
- Backend OAuth/OIDC integration.
- Google authentication.
- Account linking/unlinking.
- Minimal database migrations.
- Web login UX.
- Web account settings UX.
- Environment configuration.
- Targeted security tests.
- Documentation.

Not allowed:
- Facebook Login.
- Apple Login.
- Phone OTP.
- SMS provider integration.
- New social networking features.
- Admin dashboard.
- JWT architecture replacement.
- Major authentication rewrite.
- Unrelated UI redesign.

## 5. Mobile — Strictly Excluded

- Do not modify Mobile source.
- Do not implement Mobile Google Sign-In.
- Do not build Mobile.
- Do not typecheck Mobile.
- Do not test Mobile.

Preserve existing Mobile-facing API contracts wherever possible.

## 6. Preserve Existing Features

Do not break:
- Existing email/password login.
- Existing registration.
- Existing JWT authentication.
- Logout.
- Friends.
- DIRECT chat.
- GROUP chat.
- Nearby.
- Notifications.
- Presence.
- Realtime messaging.
- Image attachments.
- Existing user profiles.

Existing users must not lose access to their accounts or data.

---

# PART B — GOOGLE AUTHENTICATION ARCHITECTURE

## 7. Recommended Authentication Flow

Use OAuth 2.0 Authorization Code Flow with OpenID Connect.

Prefer a Backend-managed authorization flow with Spring Security OAuth2 Client where compatible with the existing architecture.

Use:
- Google as the external identity provider.
- Spring Boot Backend for secure code exchange.
- Existing GeoChat JWT for application sessions.
- React Web for login UI.

The Backend must validate the Google identity before issuing a GeoChat JWT.

Do not treat a Google access token as a GeoChat session token.

Do not trust an email address supplied directly by the browser as proof of Google identity.

## 8. Browser Redirect Flow

Expected conceptual flow:

1. User clicks "Continue with Google".
2. Browser navigates to the Backend's Google authorization initiation endpoint.
3. Backend creates an authorization request with state and appropriate security protections.
4. Browser redirects to Google's authorization page.
5. User authenticates with Google.
6. Google redirects to the registered Backend callback.
7. Backend validates the OAuth/OIDC response.
8. Backend resolves the Google identity.
9. Backend creates or finds the correct GeoChat account.
10. Backend establishes a GeoChat application session.
11. Browser returns to the Web application.
12. Web loads the authenticated user's profile.

Use the actual repository routing conventions.

Do not invent callback paths without checking Spring Security configuration.

## 9. OAuth State and PKCE

Verify:
- State is unpredictable and validated.
- Authorization requests cannot be replayed.
- Login CSRF is prevented.
- PKCE is enabled where supported and appropriate.
- Redirect URIs are exact and allowlisted.
- No arbitrary redirect parameter is trusted.
- No open redirect vulnerability is introduced.

If Spring Security OAuth2 Client manages these protections, reuse its implementation.

Do not manually recreate security protocol logic unnecessarily.

## 10. Google Identity Verification

Use the validated OIDC identity from the trusted framework.

Verify:
- Token issuer.
- Audience/client ID.
- Token signature.
- Token expiration.
- Nonce when applicable to the chosen flow.
- Stable Google subject identifier.
- Email verification status when email is used.

The primary external identity key must be:

provider = GOOGLE
providerUserId = Google OIDC subject (sub)

Do not use email as the permanent external identity key.

## 11. Required Google Scopes

Request only necessary scopes:

- openid
- email
- profile

Do not request Gmail, Drive, Contacts or other Google permissions.

Do not request offline access or refresh tokens unless an actual requirement is identified.

Do not store Google access/refresh tokens if they are not needed after authentication.

---

# PART C — USER IDENTITY MODEL

## 12. Account Linking Data Model

Inspect the current User entity and schema first.

If no suitable provider identity model exists, add a minimal identity table.

Suggested conceptual structure:

user_auth_identities
- id
- user_id
- provider
- provider_user_id
- provider_email
- created_at
- updated_at

Adjust naming and types to repository conventions.

Requirements:
- Unique (provider, provider_user_id).
- Foreign key to existing user.
- Suitable indexes.
- No unnecessary duplicate user records.
- No Google tokens stored in plaintext.
- Preserve existing users and passwords.

Use Flyway for schema changes.

Do not edit existing applied migrations.

## 13. Existing User Compatibility

Existing email/password accounts must continue working unchanged.

Do not require all users to link Google.

Do not reset existing passwords.

Do not replace existing user IDs.

Do not migrate chat or friend data unnecessarily.

## 14. First-Time Google Login

When a Google identity is not yet linked:

1. Verify Google identity.
2. Determine whether the Google email is verified.
3. Check for conflicts with existing GeoChat account records.
4. If no conflict exists, create a new GeoChat user.
5. Create the Google identity association.
6. Issue the normal GeoChat JWT.
7. Return the user to the Web application.

Use the existing profile defaults and registration business rules where applicable.

If username is required:
- Generate a collision-safe temporary username, or
- Reuse the existing onboarding flow.

Do not invent a new incompatible profile model.

## 15. Existing Google Identity

If the Google subject is already linked:
- Resolve the linked GeoChat user.
- Check account status.
- Enforce existing disabled/suspended account rules.
- Issue a GeoChat JWT using existing session conventions.
- Do not create another user.

## 16. Email Collision Handling — Critical

Scenario:

An existing GeoChat account uses:

user@example.com

A user attempts Google Sign-In with the same verified email but no linked Google identity.

Do NOT automatically link or merge these accounts.

Instead:
- Detect the collision.
- Do not create a duplicate email account if current constraints forbid it.
- Do not issue a JWT for the existing account.
- Present a safe message instructing the user to sign in using their existing method and link Google from account settings.

Do not disclose unnecessary account details to unauthenticated users.

Account linking requires proof of control over the existing GeoChat account.

## 17. Concurrency and Idempotency

Handle:
- Two simultaneous Google callbacks.
- Duplicate identity creation.
- Repeated callback attempts.
- Unique constraint violations.
- Interrupted registration.
- Transaction rollback.

Use database uniqueness constraints as the final protection.

Do not rely solely on check-then-insert logic.

Ensure a failed identity insert cannot leave an unintended partially created user.

---

# PART D — SECURE ACCOUNT LINKING

## 18. Link Google to Existing Account

An authenticated GeoChat user can link Google from account settings.

Expected flow:

1. User signs in to GeoChat using an existing method.
2. User opens Account Settings.
3. User selects "Connect Google".
4. Backend starts a dedicated OAuth linking flow.
5. User authenticates with Google.
6. Backend validates the callback.
7. Backend binds the verified Google subject to the original authenticated GeoChat account.
8. Web displays Google as connected.

Do not reuse the normal unauthenticated login flow as an implicit linking operation.

## 19. Linking Security

Critical requirements:
- Linking must be explicitly initiated by an authenticated user.
- Preserve the intended GeoChat user ID securely across the OAuth redirect.
- Bind the linking transaction to the initiating authenticated session and verify it at callback.
- Do not trust a user ID from query parameters.
- Do not rely only on the browser's current user state.
- Use short-lived, one-time linking transaction state.
- Prevent CSRF and replay.
- Prevent linking a Google identity already owned by another GeoChat account.
- Reject linking for disabled/suspended accounts.
- Handle expired GeoChat authentication safely.

Consider requiring recent authentication for sensitive linking operations.

Do not automatically transfer an identity between users.

## 20. Account Linking Conflicts

Handle:
- Google identity already linked to this user.
- Google identity linked to another user.
- User already has a different Google identity.
- OAuth authorization cancelled.
- OAuth state expired.
- User logged out during linking.
- Account disabled during linking.

Provide safe, understandable error responses.

## 21. Unlink Google

Allow unlinking only if the user retains another verified, usable login method.

Examples:
- Existing password login remains available.
- Another supported linked provider remains available in the future.

Do not permit unlinking the final usable authentication method.

Require appropriate authentication and preferably recent reauthentication.

If the repository cannot securely establish recent authentication, do not silently weaken this rule; implement a safe alternative or document the limitation.

Unlinking must not delete the GeoChat user or associated chat data.

---

# PART E — GEOCHAT JWT INTEGRATION

## 22. Existing JWT Issuance

After successful Google authentication:
- Resolve the internal GeoChat user.
- Reuse the existing JWT service.
- Preserve current claims and expiration conventions.
- Preserve current account status checks.
- Preserve current REST and WebSocket authorization behavior.

Do not issue a Google token in place of a GeoChat token.

## 23. Secure OAuth Callback Completion

Do not place long-lived GeoChat JWTs in:
- URL query parameters.
- URL fragments.
- Browser history.
- OAuth state.
- Server logs.

Prefer a short-lived, single-use login completion ticket exchanged over HTTPS/same-origin API for the normal GeoChat session response.

Requirements:
- Cryptographically unpredictable ticket.
- Very short expiration.
- One-time redemption.
- Bound to the intended browser login transaction where feasible.
- No token leakage through referrers.
- Replay protection.
- Clear failure handling.

Use an existing secure session completion mechanism if one already exists.

Do not introduce permanent server-side sessions unnecessarily.

## 24. OAuth Temporary State Storage

The OAuth authorization transaction may require temporary state storage.

Choose a solution compatible with the existing single-instance modular monolith and Docker deployment.

Requirements:
- Bounded storage.
- Expiration.
- One-time consumption.
- Safe concurrent access.
- Appropriate cookie attributes.
- No sensitive data exposure.

If using server-side HTTP sessions for OAuth state, configure their scope and security explicitly.

Document that an in-memory state store is not suitable for arbitrary multi-instance deployment without shared state or sticky routing.

Do not introduce Redis solely for this milestone.

## 25. Error Handling

Support:
- OAuth cancelled.
- Invalid state.
- Invalid callback.
- Invalid Google identity.
- Existing email collision.
- Identity linked elsewhere.
- Account suspended.
- Expired completion ticket.
- Temporary Google provider error.

Never expose:
- Client secret.
- Google authorization code.
- Google tokens.
- GeoChat JWT.
- Internal stack traces.

---

# PART F — WEB LOGIN UX

## 26. Login Page

Add a Google sign-in action to the existing login page.

Suggested text:

"Continue with Google"

Requirements:
- Preserve existing login form.
- Preserve registration links.
- Respect existing theme.
- Responsive desktop/mobile Web.
- Accessible button.
- Loading state.
- Error state.
- No duplicated auth UI.

Use an appropriate Google brand asset according to provider guidelines.

Do not create a separate authentication application.

## 27. Registration Page

If appropriate, add Google sign-up entry using the same secure authentication flow.

Avoid duplicate buttons or unnecessary redirects.

## 28. OAuth Return UX

After OAuth completion:
- Process the login result safely.
- Establish normal GeoChat auth state.
- Load current user.
- Navigate to the intended safe application route.
- Avoid redirect loops.
- Show understandable errors.
- Clean temporary completion parameters from browser history.

Do not allow arbitrary external return URLs.

## 29. Account Settings

Add a small "Connected Accounts" section.

Display:
- Google connection status.
- Provider name.
- Connected email when appropriate.
- Connect action.
- Disconnect action when allowed.

Do not display provider tokens or internal IDs.

Use existing account settings layout.

## 30. Web Error Messages

Provide user-friendly messages for:
- Google login cancelled.
- Google login temporarily unavailable.
- Existing account requires linking.
- Google already connected.
- Google connected to another account.
- Unable to disconnect final login method.
- Session expired during linking.

Do not leak whether an unrelated user's account exists.

## 31. Responsive & Accessibility

Verify:
- Keyboard navigation.
- Visible focus indicators.
- Accessible button labels.
- Light/Dark theme.
- Small mobile Web viewport.
- Loading feedback.
- Disabled states.
- Screen reader announcements where appropriate.

Do not modify Mobile application code.

---

# PART G — ENVIRONMENT & CONFIGURATION

## 32. Google OAuth Configuration

Introduce only necessary configuration values.

Potential variables:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI

Use actual Spring Security property conventions.

Do not hardcode credentials.

Do not commit real credentials.

## 33. Development and Production

Support local development without requiring VPS or a purchased domain.

Document:
- Google Cloud project setup.
- OAuth consent screen configuration.
- Web application OAuth client creation.
- Authorized redirect URI.
- Authorized JavaScript origin if actually required.
- Test users when the consent screen is in testing mode.
- Environment variable setup.

Use the actual application callback path and port.

Do not invent a fixed localhost callback if the repository uses another path.

## 34. Optional Provider Configuration

Google authentication should be optional in local development.

If Google credentials are absent in development:
- Existing email/password authentication must continue working.
- Application startup should not fail solely because Google Login is not configured.
- Google button should be hidden or clearly unavailable.
- No secret placeholders should be treated as valid credentials.

In production:
- If Google Login is enabled, missing or invalid required configuration must fail safely and visibly.
- If Google Login is intentionally disabled, existing authentication should remain functional.

Do not weaken the mandatory JWT/DB/CORS production configuration from PROMPT_040.

## 35. Docker Compatibility

Review existing:
- docker-compose.yml.
- .env.example.
- application-prod.yml.
- Nginx proxy configuration.

Ensure:
- OAuth redirects work through the Web reverse proxy.
- External callback URLs are correct.
- Trusted forwarded headers are handled safely.
- HTTPS behavior is correct for future deployment.
- Secrets remain server-side.
- Existing /api and /ws routes continue working.

Do not rebuild the deployment architecture.

Do not expose Backend publicly solely for OAuth.

## 36. Localhost Security

Localhost HTTP may be used for local development where supported.

Production must use HTTPS.

Do not disable OAuth state validation, CSRF protection or secure redirect validation to make local testing easier.

---

# PART H — DATABASE MIGRATION

## 37. Flyway Migration

Only add a migration if the current schema lacks a suitable provider identity association.

Requirements:
- Follow existing migration naming.
- Do not modify applied migrations.
- Preserve existing user data.
- Add required uniqueness constraints.
- Add foreign keys.
- Add indexes where justified.
- Make changes compatible with PostgreSQL.

Do not delete existing user records.

## 38. Migration Validation

Test:
- Existing users remain intact.
- Existing password login works.
- New Google identity can be stored.
- Duplicate provider identity is rejected.
- Concurrent linking conflicts are handled.
- Unlinking preserves user data.
- Foreign key integrity is maintained.

Use a disposable database for destructive test scenarios.

Do not reset the user's persistent Docker database.

---

# PART I — SECURITY TESTS

## 39. Backend Tests

Add focused tests for:

1. Existing password login still works.
2. Valid Google identity resolves an existing linked user.
3. New Google identity creates a user safely.
4. Existing email collision does not auto-link.
5. Unverified email handling.
6. Duplicate Google subject.
7. Concurrent first-time login.
8. Disabled account rejection.
9. Invalid OAuth state.
10. Replayed OAuth callback.
11. Expired OAuth state.
12. Invalid OIDC token.
13. Wrong audience.
14. Wrong issuer.
15. Expired token.
16. Authenticated account linking.
17. Unauthenticated linking rejection.
18. Cross-account linking rejection.
19. Linking transaction bound to intended user.
20. Google identity already linked elsewhere.
21. Unlinking with another usable method.
22. Reject unlinking the final login method.
23. Expired completion ticket.
24. Replayed completion ticket.
25. Existing GeoChat JWT behavior.
26. No provider token leakage.

Use Spring Security testing facilities where appropriate.

Mock external Google responses for automated tests.

Do not make tests depend on a live Google account.

## 40. Web Tests

Test:
- Google button visibility.
- Google button disabled/hidden when not configured.
- OAuth return handling.
- Existing login form remains functional.
- Error messages.
- Connected Accounts UI.
- Link/unlink actions.
- 401 handling.
- Responsive layout.
- Light/Dark themes.

## 41. Integration Tests

Where feasible, test:
- User creation and identity persistence.
- Database uniqueness.
- JWT issuance.
- Account linking.
- Account unlinking.
- OAuth callback handling with mocked provider responses.

Avoid making external network requests in CI.

## 42. Manual Google Login Verification

When valid Google OAuth credentials are available:

Scenario A — New Google User:
- Sign in with Google.
- Verify a new GeoChat user is created.
- Verify normal application access.

Scenario B — Returning Google User:
- Sign out.
- Sign in again with Google.
- Verify the same GeoChat user ID is used.

Scenario C — Existing Account:
- Sign in with existing email/password.
- Open Account Settings.
- Link Google.
- Sign out.
- Sign in with Google.
- Verify existing chats, friends and groups remain.

Scenario D — Email Collision:
- Attempt Google Login using an email already registered but not linked.
- Verify no automatic account takeover.

Scenario E — Unlink:
- Unlink Google while another login method exists.
- Verify existing login remains functional.

Scenario F — Security:
- Attempt invalid/replayed linking state.
- Verify rejection.

Do not claim live Google verification if credentials are unavailable.

---

# PART J — VALIDATION

## 43. Backend Validation

Run:
- Backend compilation.
- Relevant Backend tests.
- Authentication regression tests.
- Flyway validation where applicable.

Use Maven Wrapper.

Report exact results.

## 44. Web Validation

Run:
- Web tests.
- TypeScript validation.
- Production build.
- Lint where configured.

Do not run Mobile tests.

## 45. Docker Validation

If Docker is available:
- Validate Compose configuration.
- Build affected images.
- Verify existing login still works.
- Verify OAuth callback routing.
- Verify /api and /ws behavior remains intact.

Do not delete volumes.

If Docker is unavailable, mark tests BLOCKED.

## 46. GitHub CI

Inspect whether new tests are covered by existing GitHub Actions.

Do not claim CI passed without an actual runner result.

Preserve PROMPT_042 release-readiness blockers until independently verified.

---

# PART K — IMPLEMENTATION PHASES

## 47. Phase 1 — Audit

- Inspect authentication and user model.
- Inspect Web login and settings.
- Inspect deployment configuration.
- Identify missing capabilities.
- Document security-sensitive design decisions.

## 48. Phase 2 — Identity Persistence

- Add minimal provider identity model if missing.
- Add Flyway migration if necessary.
- Add uniqueness constraints.
- Add repository/service tests.

## 49. Phase 3 — Google OAuth/OIDC

- Configure Google provider.
- Implement secure login flow.
- Validate identity.
- Handle first-time and returning users.
- Reuse GeoChat JWT.

## 50. Phase 4 — Account Linking

- Implement authenticated linking.
- Prevent email-based auto-linking.
- Implement safe unlinking.
- Handle identity conflicts.

## 51. Phase 5 — Web UX

- Add Google login action.
- Add OAuth completion handling.
- Add Connected Accounts settings.
- Add error/loading states.
- Verify responsiveness.

## 52. Phase 6 — Configuration & Documentation

- Update environment templates.
- Document Google Cloud setup.
- Verify Docker/Nginx compatibility.
- Preserve existing production security.

## 53. Phase 7 — Tests & Regression

- Run Backend tests.
- Run Web tests/build.
- Validate database migration.
- Test authentication and linking.
- Document live OAuth testing limitations.

---

# PART L — ACCEPTANCE CRITERIA

## 54. Completion Checklist

PROMPT_043 is complete when:

- [ ] Existing authentication was audited.
- [ ] Existing email/password login remains functional.
- [ ] Google OAuth/OIDC flow is implemented securely.
- [ ] Google identity is resolved using provider subject.
- [ ] First-time Google user creation is supported.
- [ ] Returning Google user resolves the same account.
- [ ] Existing email collision does not auto-link.
- [ ] Account linking requires authenticated authorization.
- [ ] Cross-account linking is rejected.
- [ ] Account linking state is replay-resistant.
- [ ] Google unlinking is safe.
- [ ] Final usable login method cannot be removed.
- [ ] Existing GeoChat JWT remains the application authentication mechanism.
- [ ] Google tokens are not exposed or logged.
- [ ] OAuth callback does not leak GeoChat JWT.
- [ ] Web Google Login UI is implemented.
- [ ] Web Connected Accounts UI is implemented.
- [ ] Local development setup is documented.
- [ ] Google credentials are not committed.
- [ ] Missing optional development credentials do not break password login.
- [ ] Flyway migration is safe, if required.
- [ ] Backend tests pass.
- [ ] Web tests and build pass.
- [ ] Existing chat/friends/Nearby/notifications remain functional.
- [ ] Docker integration is verified where available.
- [ ] Mobile remains unchanged.
- [ ] Unverified live Google flows are explicitly reported.

## 55. Completion Status

Distinguish:
- IMPLEMENTED.
- VERIFIED BY AUTOMATED TEST.
- VERIFIED LOCALLY.
- VERIFIED WITH LIVE GOOGLE.
- NOT VERIFIED.
- BLOCKED.

If real Google OAuth credentials are not available, automated implementation may be complete, but live provider verification must remain NOT VERIFIED.

Do not claim the complete real-world Google login flow was tested unless it was actually executed.

## 56. Final Report

Provide a Vietnamese report containing:

1. Initial audit.
2. Existing authentication reused.
3. Google OAuth architecture.
4. Identity data model.
5. Flyway migrations.
6. First-time Google login.
7. Returning Google login.
8. Account linking.
9. Account unlinking.
10. Email collision protection.
11. OAuth state/PKCE protections.
12. JWT integration.
13. Web login UX.
14. Connected Accounts UX.
15. Environment configuration.
16. Google Cloud setup instructions.
17. Files created.
18. Files modified.
19. Backend test results.
20. Web test/build results.
21. Docker validation results.
22. Live Google OAuth verification status.
23. API compatibility.
24. Mobile compatibility.
25. Known security limitations.
26. Remaining PROMPT_042 release-readiness blockers.
27. Recommended next milestone.

End with exactly one of:

PROMPT_043 COMPLETE

or

PROMPT_043 NOT COMPLETE

Only report COMPLETE when the implementation and required automated validation are finished and no unresolved Critical or High security issue remains in scope.

Clearly state if live Google OAuth testing is still pending.