# PROMPT_044 — GeoChat Facebook Login & Secure Account Linking

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology:
- Backend: Java 21, Spring Boot, Spring Security.
- Database: PostgreSQL 16 + PostGIS.
- Database migrations: Flyway.
- Authentication: Existing GeoChat JWT.
- Web: React, TypeScript, Vite.
- Realtime: WebSocket/STOMP.
- Deployment: Docker Compose and Nginx.
- Architecture: Modular monolith.
- Development: Windows, Maven Wrapper.
- Mobile: Paused.

Confirmed project milestones:
- PROMPT_040: Security & Production Readiness implementation.
- PROMPT_041: Deployment & Monitoring Foundation.
- PROMPT_042: Release Verification & Reliability implementation.
- PROMPT_043: Google Login & Account Linking, user-accepted after successful live Google login and account linking.

Important:
Release readiness is NOT yet fully verified. Some Docker/database security checks, GitHub CI and UI smoke tests remain pending.

The repository is the source of truth. Do not assume the exact package names, endpoints, database columns or configuration paths.

## 2. Main Objective

Add Facebook Login to GeoChat Web using Meta's supported Facebook Login OAuth flow.

Users must be able to:
1. Sign in using Facebook.
2. Create a GeoChat account using Facebook when eligible.
3. Sign in again using the same Facebook identity.
4. Link Facebook to an existing GeoChat account.
5. See Facebook connection status in Account Settings.
6. Unlink Facebook safely.
7. Continue using Google Login and email/password login.
8. Use the same GeoChat JWT, REST APIs and WebSocket functionality.

The implementation must reuse the account identity infrastructure introduced by PROMPT_043.

Do NOT create a separate user system for Facebook.

---

# PART A — AUDIT BEFORE IMPLEMENTATION

## 3. Mandatory Repository Audit

Before writing code, inspect:

Backend:
- Existing email/password authentication.
- Google OAuth implementation from PROMPT_043.
- Spring Security configuration.
- OAuth callback and state handling.
- OAuth login completion ticket mechanism, if present.
- Existing JWT service.
- User entity and repository.
- Provider identity entity/table.
- Account linking/unlinking services.
- Account status checks.
- Rate limiting.
- Exception handling.
- Flyway migrations.
- Authentication security tests.

Web:
- Login page.
- Registration page.
- Google login button and flow.
- OAuth callback handling.
- Account Settings.
- Connected Accounts component.
- Authentication context/store.
- API client.
- Error/toast handling.
- Responsive styling.

Infrastructure:
- Environment variables.
- Spring application configuration.
- Docker Compose.
- Nginx proxy routes.
- Existing CI workflow.

Classify each requirement:
- ALREADY IMPLEMENTED.
- REUSABLE.
- NEEDS EXTENSION.
- MISSING.
- BLOCKED BY EXTERNAL CONFIGURATION.

Produce a concise audit summary.

Do not duplicate the Google OAuth architecture.

## 4. Implementation Principles

- Make small, targeted changes.
- Preserve existing APIs where possible.
- Reuse provider-neutral identity services.
- Keep security checks server-side.
- Prefer official framework-supported OAuth mechanisms.
- Do not weaken existing authentication security.
- Do not introduce unnecessary dependencies.
- Do not implement unrelated features.
- Do not modify Mobile.

If an existing generic OAuth provider implementation already supports Facebook safely, extend it rather than creating parallel controllers/services.

---

# PART B — FACEBOOK OAUTH

## 5. Facebook Login Architecture

Implement Facebook Login using the currently supported Meta OAuth authorization flow for the selected Facebook Login product and app configuration.

Unlike Google OIDC, do not assume Facebook supplies a Google-style ID token.

Use the OAuth authorization code flow with a confidential server-side client where supported.

Expected flow:

1. User clicks "Continue with Facebook".
2. Web initiates authentication through Backend.
3. Backend generates and stores an OAuth authorization transaction.
4. Browser redirects to Facebook authorization.
5. User authorizes the application.
6. Facebook redirects to the configured callback.
7. Backend validates state and exchanges the authorization code.
8. Backend retrieves the Facebook identity through the appropriate authenticated provider API.
9. Backend resolves or creates the correct GeoChat user.
10. Backend issues the existing GeoChat session credentials.
11. Browser returns to GeoChat Web.
12. User can use the application normally.

Do not implement token exchange in the browser if the Backend can handle it securely.

## 6. Provider Configuration

Use the appropriate Spring Security OAuth2 Client configuration where supported.

Inspect whether a Facebook provider registration already exists.

Use configuration names consistent with the repository.

Potential environment variables:

FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
FACEBOOK_REDIRECT_URI
FACEBOOK_LOGIN_ENABLED

Do not hardcode credentials.

Do not commit real App Secrets.

Do not expose App Secrets through Vite environment variables.

Do not assume the same endpoint paths used by Google.

Use Meta's currently documented authorization, token and profile endpoints for the configured Facebook Login product.

Avoid hardcoding obsolete Graph API versions.

Pin a supported version where required and document the upgrade process.

## 7. Requested Permissions

Request the minimum necessary permissions.

For a basic login, evaluate:
- public_profile
- email

Do not request:
- Friends list.
- Pages management.
- Messaging permissions.
- Advertising permissions.
- Business management permissions.
- Other unrelated Facebook data.

Do not request advanced permissions without a justified requirement.

The application must work safely when Facebook does not return an email address.

## 8. Facebook Identity

Use Facebook's stable application-scoped user ID returned by the verified provider identity endpoint.

Store the association as:

provider = FACEBOOK
providerUserId = verified Facebook app-scoped user ID

Do not use:
- Facebook display name.
- Facebook profile URL.
- Facebook email address.

as the permanent external identity key.

Treat Facebook email as optional.

Do not assume a Facebook email is verified to the same assurance level as Google's verified OIDC email claim.

## 9. Token and Identity Validation

Requirements:
- Validate OAuth state.
- Protect against login CSRF.
- Exchange authorization code server-side.
- Use the correct App ID and App Secret.
- Validate the returned access token using the provider's supported verification/debugging mechanism where appropriate.
- Verify token validity, intended app identity and required permissions.
- Fetch the identity using a trusted provider endpoint.
- Reject malformed, expired or invalid tokens.
- Prevent replay of one-time login completion artifacts.
- Never trust user IDs or emails submitted directly by the browser.

Use PKCE when supported by the selected provider flow and framework. Do not invent or assume unsupported protocol parameters.

Do not expose Facebook access tokens to the Web.

Do not store Facebook access tokens unless a demonstrated requirement exists.

Do not log Facebook authorization codes, tokens or App Secrets.

---

# PART C — ACCOUNT IDENTITY INTEGRATION

## 10. Reuse PROMPT_043 Identity Model

Inspect the existing provider identity table.

If it already supports multiple providers:
- Reuse it.
- Add FACEBOOK as a supported provider where needed.
- Reuse its unique constraints.
- Reuse existing repositories.
- Reuse existing account linking services.

Do not create a Facebook-specific identity table.

Expected conceptual structure:

user_auth_identities
- id
- user_id
- provider
- provider_user_id
- provider_email
- created_at
- updated_at

Use actual repository naming.

Only create a Flyway migration if a schema or database constraint genuinely requires it.

Never edit previously applied Flyway migrations.

## 11. First-Time Facebook Login

When a Facebook identity has not been linked:

1. Validate the Facebook identity.
2. Check whether the provider identity already exists.
3. Determine whether the supplied email is usable and whether an existing account conflicts.
4. If eligible, create a GeoChat user.
5. Associate the Facebook identity with the new user.
6. Issue the existing GeoChat JWT.
7. Return the user to Web.

Follow existing user registration rules.

Do not generate a fake email address to bypass email uniqueness constraints.

If GeoChat requires an email address, implement a minimal, secure onboarding step to collect and verify one before activating an account that requires email.

Do not treat an unverified user-entered email as proof of account ownership.

If an email is not required, support Facebook-only users without an email where the existing domain model permits it.

Do not introduce a broad user model redesign solely to support email-less Facebook accounts.

If the current schema cannot safely support the chosen onboarding flow, document the constraint and implement a safe, limited alternative.

## 12. Returning Facebook User

When the Facebook provider identity already exists:
- Resolve the linked GeoChat user.
- Enforce account status checks.
- Issue the existing GeoChat JWT.
- Preserve user ID and profile.
- Do not create another account.

Verify that friends, groups, messages and Nearby preferences remain associated with the same GeoChat user.

## 13. Email Collision Protection

Critical security requirement:

An existing GeoChat user has:

user@example.com

A Facebook identity returns the same email but has never been linked.

Do NOT automatically merge or link these accounts.

Do NOT grant access to the existing GeoChat user based only on matching email.

Instead:
- Detect the collision.
- Stop automatic account creation if existing constraints would conflict.
- Show a safe explanation.
- Ask the user to sign in using their existing GeoChat authentication method.
- Allow explicit Facebook linking from authenticated Account Settings.

Avoid unnecessary account enumeration.

## 14. Missing Facebook Email

Handle the case where Facebook returns:
- A valid provider user ID.
- A display name.
- No email.

Expected behavior:
- No crash.
- No null pointer exception.
- No invented email.
- No accidental account merge.
- Clear onboarding instructions if email is required.
- Safe continuation when the data model permits email-less accounts.

Add tests for this case.

## 15. Transaction Safety

Handle:
- Simultaneous first-time Facebook logins.
- Duplicate callback requests.
- Duplicate provider identity inserts.
- User creation failure.
- Provider identity insert failure.
- Interrupted onboarding.
- Database uniqueness conflicts.

Use transactions and database uniqueness constraints.

Do not leave orphaned user accounts or partially linked identities.

---

# PART D — FACEBOOK ACCOUNT LINKING

## 16. Link Facebook to an Existing GeoChat Account

An authenticated user must be able to:

1. Open Account Settings.
2. Open Connected Accounts.
3. Click "Connect Facebook".
4. Authorize with Facebook.
5. Return to GeoChat.
6. See Facebook marked as connected.

Reuse the secure account linking transaction design from PROMPT_043.

## 17. Linking Security

Requirements:
- Explicit linking action.
- Existing authenticated GeoChat session.
- Secure binding to the initiating GeoChat user.
- Short-lived linking transaction.
- CSRF protection.
- One-time state consumption.
- Replay prevention.
- No user ID accepted from untrusted query parameters.
- No automatic account transfer.
- No linking an identity already associated with another user.
- Reject linking if the original authenticated session is invalid or expired.

Do not assume that returning from Facebook proves ownership of the intended GeoChat account.

## 18. Multiple Providers on One Account

Support one GeoChat user with:

- Email/password login, if configured.
- Google identity.
- Facebook identity.

All login methods must resolve to the same internal GeoChat user ID when explicitly linked.

Do not duplicate:
- Friends.
- Groups.
- Messages.
- Profile.
- Notifications.
- Nearby preferences.

## 19. Facebook Already Linked Elsewhere

If a Facebook identity is already associated with another GeoChat account:
- Reject linking.
- Do not move the identity.
- Do not merge users.
- Do not expose unrelated account information.

Return a safe user-friendly error.

## 20. Unlink Facebook

Allow Facebook unlinking only if another usable login method remains.

Examples:
- Existing password authentication.
- Linked Google Login.

If Facebook is the final usable login method:
- Reject unlinking.
- Explain why.

Unlinking must not delete:
- User profile.
- Messages.
- Friends.
- Groups.
- Notifications.

Apply the same recent-authentication safeguards used for Google unlinking.

If those safeguards are incomplete, document and address the gap instead of weakening Facebook unlinking.

---

# PART E — JWT AND SESSION COMPATIBILITY

## 21. Existing GeoChat JWT

After successful Facebook authentication:
- Resolve the internal user.
- Reuse the existing JWT service.
- Reuse existing claims and expiration rules.
- Reuse account status checks.
- Preserve REST authentication.
- Preserve WebSocket/STOMP authentication.

Do not replace GeoChat JWT with Facebook tokens.

## 22. Secure Login Completion

Reuse the secure OAuth login completion mechanism implemented for Google.

Prefer a short-lived, one-time completion ticket where already supported.

Do not put GeoChat JWT in:
- URL query strings.
- URL fragments.
- OAuth state.
- Browser history.
- Server logs.

Do not create a second incompatible callback/session mechanism.

## 23. OAuth Error Handling

Handle:
- User cancels Facebook login.
- Access denied.
- Invalid OAuth state.
- Expired state.
- Invalid authorization code.
- Token exchange failure.
- Provider API failure.
- Missing email.
- Existing email conflict.
- Identity linked elsewhere.
- Suspended GeoChat account.
- Expired login completion ticket.

Return safe errors.

Never expose internal stack traces or secrets.

---

# PART F — WEB UX

## 24. Login Page

Add:

"Continue with Facebook"

to the existing login page.

Preserve:
- Email/password login.
- Google Login.
- Registration links.
- Existing layout.
- Light/Dark theme.
- Responsive behavior.

Use an appropriate Facebook icon according to Meta branding guidelines.

Do not redesign the entire login page.

## 25. Registration Page

If the current UX supports provider-based registration, add Facebook consistently.

Avoid duplicate authentication flows.

## 26. Connected Accounts

Extend the existing Account Settings section.

Example:

Connected Accounts

Google       Connected
Facebook     Not connected

When Facebook is connected:
- Show connection status.
- Show associated email if available and appropriate.
- Show disconnect action when allowed.

When not connected:
- Show Connect Facebook.

Do not display Facebook access tokens or internal provider IDs.

## 27. Loading and Error States

Add clear feedback for:
- Redirecting to Facebook.
- Authentication in progress.
- User cancelled authorization.
- Facebook login unavailable.
- Account already exists.
- Facebook identity already linked.
- Linking succeeded.
- Unlinking succeeded.
- Cannot unlink last login method.

Avoid duplicate toast messages.

Avoid redirect loops.

## 28. Accessibility and Responsive UX

Verify:
- Keyboard navigation.
- Visible focus.
- Accessible button names.
- Screen reader labels.
- Mobile browser layout.
- Tablet layout.
- Desktop layout.
- Light/Dark themes.

Do not modify the native Mobile application.

---

# PART G — META DEVELOPER SETUP

## 29. Facebook App Configuration

Document how to create and configure a Meta developer app.

Include:
1. Access Meta for Developers.
2. Create or select a Meta app.
3. Configure the appropriate Facebook Login product/use case.
4. Obtain App ID.
5. Obtain App Secret.
6. Configure the required redirect URI.
7. Configure the required app domains/settings.
8. Configure necessary permissions.
9. Add development roles or test accounts where applicable.
10. Test the OAuth flow.
11. Understand requirements for making login available to users outside the app's permitted development/test audience.

Meta's UI and requirements may change.

Use currently applicable documentation rather than assuming old console labels.

## 30. Localhost Setup

GeoChat should support development on localhost where allowed by Meta's current configuration rules.

Determine the actual Web URL, Backend URL and OAuth callback URL from the repository.

Do not invent ports.

The registered callback must match the actual callback URI precisely.

Document:
- Protocol.
- Host.
- Port.
- Callback path.
- Proxy behavior.

Do not disable OAuth security checks to make localhost testing work.

## 31. Environment Variables

Update .env.example or relevant configuration documentation.

Do not put real secrets into source control.

If Facebook Login is not configured locally:
- Existing password login must still work.
- Google Login must still work.
- Facebook button should be hidden or clearly unavailable.
- Application startup should not fail solely because optional Facebook credentials are missing.

If Facebook Login is enabled:
- Missing required configuration must fail safely and visibly.

## 32. Docker and Nginx

Inspect the existing reverse proxy.

Verify that Facebook OAuth authorization and callback routes are correctly forwarded.

Pay attention to:
- /api routing.
- OAuth callback path.
- X-Forwarded-Proto.
- X-Forwarded-Host.
- X-Forwarded-Port.
- Spring forwarded header configuration.
- Same-origin login completion.
- HTTP localhost versus HTTPS production.

Do not add arbitrary public Backend ports.

Do not rewrite the existing deployment architecture.

---

# PART H — DATABASE

## 33. Flyway Rules

Only add a migration when needed.

Possible reasons:
- Existing provider enum/check constraint excludes FACEBOOK.
- Provider identity table requires a compatible extension.
- Email nullability must change for a justified onboarding design.

Do not modify applied migrations.

Do not reset PostgreSQL.

Do not delete real user data.

## 34. Database Tests

Verify:
- One user can have Google and Facebook identities.
- One Facebook identity belongs to only one user.
- Duplicate provider identities are rejected.
- Unlinking preserves the user.
- Existing Google identities remain valid.
- Existing password accounts remain valid.
- Concurrent linking does not corrupt identity records.

---

# PART I — SECURITY TESTS

## 35. Backend Test Cases

Add targeted tests for:

1. Existing password login.
2. Existing Google Login regression.
3. Valid Facebook identity.
4. First-time Facebook login.
5. Returning Facebook login.
6. Missing Facebook email.
7. Existing email collision.
8. Duplicate Facebook identity.
9. Invalid OAuth state.
10. Replayed OAuth state.
11. Expired OAuth state.
12. Invalid authorization code.
13. Failed token exchange.
14. Invalid provider token.
15. Token issued for the wrong app.
16. Provider identity lookup failure.
17. Disabled GeoChat account.
18. Account linking requires authentication.
19. Linking state bound to initiating user.
20. Facebook identity already linked elsewhere.
21. Linking Google and Facebook to one user.
22. Unlinking Facebook with Google available.
23. Reject unlinking the final login method.
24. Concurrent first-time login.
25. Replayed completion ticket.
26. No provider token leakage.
27. JWT issuance compatibility.
28. WebSocket authentication regression.

Mock Facebook/Meta responses for automated tests.

Do not require a real Facebook account for CI tests.

## 36. Web Tests

Test:
- Facebook button.
- Google button remains visible.
- Password login remains visible.
- Disabled/hidden Facebook state.
- OAuth return handling.
- Connected Accounts status.
- Connect Facebook action.
- Disconnect Facebook action.
- Error handling.
- Loading states.
- Responsive behavior.

## 37. Manual Facebook Login Tests

When valid Meta credentials and an authorized test account are available:

Scenario A:
- Sign in with Facebook for the first time.
- Verify correct account creation.

Scenario B:
- Sign out and sign in again with Facebook.
- Verify same internal GeoChat user ID.

Scenario C:
- Sign in using existing email/password or Google.
- Connect Facebook.
- Sign out.
- Sign in using Facebook.
- Verify original profile, friends, groups and messages.

Scenario D:
- Attempt Facebook login with an email matching an unlinked GeoChat account.
- Verify no automatic merge.

Scenario E:
- Test Facebook account with no email returned.
- Verify safe behavior.

Scenario F:
- Unlink Facebook while Google remains connected.
- Verify Google Login still works.

Scenario G:
- Attempt to unlink the last usable authentication method.
- Verify rejection.

Scenario H:
- Cancel Facebook authorization.
- Verify safe return to GeoChat.

Scenario I:
- Log in through Facebook and send messages.
- Verify REST and realtime WebSocket work.

Do not claim these tests passed unless actually executed.

---

# PART J — VALIDATION

## 38. Backend Validation

Run the appropriate existing Maven Wrapper commands for:
- Compilation.
- Unit tests.
- Authentication tests.
- Security tests.
- Database integration tests where available.

Report actual results.

## 39. Web Validation

Run:
- Web tests.
- TypeScript checks.
- Production build.
- Lint where configured.

Report actual results.

## 40. Docker Validation

If Docker is available:
- Validate Compose configuration.
- Build affected services.
- Verify OAuth callback routing.
- Verify existing Google Login remains functional.
- Verify WebSocket behavior.

Do not delete volumes.

If Docker is unavailable, report BLOCKED.

## 41. CI Validation

Ensure existing CI covers new automated tests.

Do not claim GitHub Actions passed without a real runner result.

Keep outstanding PROMPT_042 release verification issues visible.

---

# PART K — IMPLEMENTATION PHASES

## 42. Phase 1 — Audit

- Inspect PROMPT_043 implementation.
- Identify reusable OAuth components.
- Identify Facebook-specific requirements.
- Confirm current routing and database model.

## 43. Phase 2 — Backend Provider Integration

- Configure Facebook OAuth.
- Implement identity retrieval and validation.
- Reuse GeoChat JWT issuance.
- Handle first-time and returning users.

## 44. Phase 3 — Account Linking

- Extend provider-neutral linking.
- Extend unlinking.
- Handle missing email.
- Handle provider conflicts.
- Preserve existing Google behavior.

## 45. Phase 4 — Web

- Add Facebook Login.
- Extend Connected Accounts.
- Add error/loading states.
- Verify responsive UI.

## 46. Phase 5 — Configuration

- Add optional environment variables.
- Document Meta developer setup.
- Verify Nginx callback routing.
- Preserve Docker compatibility.

## 47. Phase 6 — Testing

- Backend tests.
- Web tests.
- Database tests.
- Google regression tests.
- Facebook live OAuth tests where credentials are available.

---

# PART L — ACCEPTANCE CRITERIA

## 48. Completion Checklist

- [ ] Existing Google Login implementation audited.
- [ ] Facebook OAuth implemented securely.
- [ ] Facebook identity resolved using provider user ID.
- [ ] New Facebook user creation works.
- [ ] Returning Facebook user resolves same GeoChat account.
- [ ] Missing email handled safely.
- [ ] Existing email collision does not auto-link.
- [ ] Facebook can be linked to an existing account.
- [ ] Facebook cannot be linked to two different accounts.
- [ ] Google and Facebook can be linked to the same GeoChat user.
- [ ] Facebook can be unlinked safely.
- [ ] Final usable login method cannot be removed.
- [ ] Existing GeoChat JWT is reused.
- [ ] Facebook access tokens are not exposed.
- [ ] OAuth state is validated.
- [ ] OAuth callback replay is prevented.
- [ ] Login completion remains secure.
- [ ] Facebook button appears on Web.
- [ ] Connected Accounts supports Facebook.
- [ ] Existing Google Login remains functional.
- [ ] Existing password login remains functional.
- [ ] Existing chat, groups, friends and Nearby work.
- [ ] Configuration documented.
- [ ] No real credentials committed.
- [ ] Database migration is safe, if required.
- [ ] Backend tests pass.
- [ ] Web tests and build pass.
- [ ] Mobile code remains unchanged.
- [ ] Live Facebook verification status is reported honestly.
- [ ] PROMPT_042 release blockers remain documented.

## 49. Completion Status Rules

Distinguish:

- IMPLEMENTED.
- VERIFIED BY AUTOMATED TEST.
- VERIFIED LOCALLY.
- VERIFIED WITH LIVE FACEBOOK.
- NOT VERIFIED.
- BLOCKED.

If Meta App ID/Secret or a permitted test account is unavailable:
- Complete implementation and automated tests where possible.
- Document setup instructions.
- Mark live Facebook verification as NOT VERIFIED.
- Do not claim successful live Facebook Login.

Do not claim production readiness.

## 50. Final Report — Vietnamese

Provide:

1. Audit summary.
2. Reused PROMPT_043 components.
3. Facebook OAuth implementation.
4. Facebook identity verification.
5. New user flow.
6. Returning user flow.
7. Missing email handling.
8. Email collision protection.
9. Account linking.
10. Account unlinking.
11. Google + Facebook identity coexistence.
12. JWT integration.
13. Web changes.
14. Environment variables.
15. Meta developer setup.
16. Database migrations.
17. Files created.
18. Files modified.
19. Backend tests and results.
20. Web tests and build results.
21. Docker validation.
22. Live Facebook Login verification.
23. Google Login regression status.
24. API compatibility.
25. Mobile unchanged confirmation.
26. Known issues and blockers.
27. Outstanding PROMPT_042 release verification items.
28. Recommended next milestone.

End with:

PROMPT_044 COMPLETE

or

PROMPT_044 NOT COMPLETE

Only mark COMPLETE if implementation and required automated validation pass without unresolved Critical/High issues in scope.

Explicitly state whether real Facebook Login was tested successfully.