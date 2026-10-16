# PROMPT_040 — GeoChat Security Hardening & Production Readiness

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS.
- Database migrations: Flyway.
- Authentication: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Development postponed.

Confirmed completed milestones:
- PROMPT_036 — Nearby Discovery & Map UX.
- PROMPT_037 — Friend Discovery & Connection UX.
- PROMPT_038 — Chat Performance & Pagination Optimization.
- PROMPT_039 — Notifications & Realtime UX.

Earlier milestones include authentication, chat, group management, unread state, presence, reactions, attachments and related UI improvements.

The current repository is the source of truth.

Do not assume any feature is missing simply because it is listed in this prompt.

## 2. Primary Objective

Improve the security, privacy, reliability and production configuration of GeoChat without introducing unrelated product features.

Focus on:

1. Authentication and JWT security.
2. Authorization and object-level access control.
3. WebSocket authentication and authorization.
4. Nearby location privacy.
5. Secure image and attachment access.
6. Rate limiting and abuse prevention.
7. Input validation and safe error handling.
8. CORS, secrets and production configuration.
9. Sensitive-data logging protection.
10. Security regression testing.

This milestone is SECURITY HARDENING, not a rewrite of the application.

Do not implement full deployment or CI/CD in this milestone.

---

# PART A — MANDATORY DEVELOPMENT RULES

## 3. Audit First, Implement Second

This is the most important rule.

Before changing code, inspect the existing implementation and classify each requirement as:

- ALREADY IMPLEMENTED — Working correctly; no change needed.
- NEEDS IMPROVEMENT — Exists but has a verified weakness.
- MISSING — Required protection does not exist.
- NOT APPLICABLE — Not relevant to the current architecture.

Create a concise security audit report.

For every NEEDS IMPROVEMENT or MISSING item, document:
- Affected component.
- Evidence from the repository.
- Security impact.
- Severity: Critical, High, Medium or Low.
- Proposed minimal fix.
- Regression risk.

Prioritize verified Critical and High findings.

Do not add code solely to make the diff larger.

Do not recreate existing authentication, validation, notification or security infrastructure.

## 4. Web-first Scope

Primary scope:
- Backend security.
- Web authentication and security UX.
- Supporting database changes only when necessary.

Web should provide clear user feedback for:
- Expired sessions.
- Unauthorized actions.
- Rate limiting.
- Upload validation failures.
- Recoverable network errors.

Do not redesign the entire UI.

## 5. Mobile — Strictly Excluded

- Do not modify Mobile source.
- Do not implement Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Mobile code may be inspected read-only to understand API compatibility.

Preserve existing Mobile-facing API contracts whenever possible.

If a security fix requires a breaking API change, document the compatibility impact before implementing it.

## 6. Architecture Constraints

Preserve:
- Java 21.
- Existing Spring Boot architecture.
- PostgreSQL/PostGIS.
- Flyway migration history.
- JWT authentication.
- Existing REST routes.
- Existing WebSocket destinations.
- DIRECT and GROUP chat behavior.
- Nearby privacy rules.
- Friends and notifications.
- Existing message pagination.
- Existing theme and responsive UI.

Avoid:
- Rewriting authentication.
- Replacing JWT with another auth provider.
- Introducing OAuth2/social login.
- Introducing Redis solely for security.
- Kafka, RabbitMQ or microservices.
- Large-scale refactoring.
- Unnecessary new dependencies.
- Unnecessary database migrations.

Do not weaken existing security controls to make tests pass.

---

# PART B — SECURITY AUDIT

## 7. Inspect Backend Security

Inspect:
1. Spring Security configuration.
2. SecurityFilterChain.
3. JWT generation and validation.
4. JWT authentication filter.
5. Password hashing.
6. Authentication endpoints.
7. Logout/session behavior.
8. Controller authorization.
9. Service-layer authorization.
10. Repository ownership checks.
11. WebSocket authentication.
12. WebSocket subscription authorization.
13. CORS configuration.
14. Exception handling.
15. File upload/download.
16. Location privacy.
17. Logging configuration.
18. Environment variable handling.
19. Actuator exposure, if present.
20. Dependency versions and existing security tests.

Inspect the actual code rather than relying on documentation alone.

## 8. Inspect Web Security

Inspect:
1. Login/logout behavior.
2. JWT storage and usage.
3. API client interceptors.
4. 401 and 403 handling.
5. WebSocket authentication.
6. User-controlled content rendering.
7. Image and attachment URLs.
8. Route protection.
9. Error messages.
10. Browser storage usage.
11. Existing session-expiry UX.
12. Notification payload handling.
13. Location permission handling.
14. External links.
15. Existing security-related tests.

## 9. Initial Security Audit Deliverable

Before implementation, provide a table:

| Area | Current State | Finding | Severity | Action |
|------|---------------|---------|----------|--------|
| JWT | ... | ... | ... | ... |
| REST Authorization | ... | ... | ... | ... |
| WebSocket | ... | ... | ... | ... |
| Nearby Privacy | ... | ... | ... | ... |
| File Access | ... | ... | ... | ... |
| Rate Limiting | ... | ... | ... | ... |
| Validation | ... | ... | ... | ... |
| Configuration | ... | ... | ... | ... |

Do not invent findings.

Continue with the smallest justified implementation.

---

# PART C — AUTHENTICATION & JWT

## 10. JWT Validation

Inspect existing JWT validation.

Verify:
- Signature validation.
- Expected signing algorithm.
- Token expiration.
- Malformed token handling.
- Invalid signature handling.
- Missing token handling.
- Authentication principal extraction.
- Safe secret configuration.

Reject invalid or expired tokens.

Do not trust unverified JWT claims.

Do not log full JWT values.

## 11. JWT Secret Configuration

Verify:
- JWT secret comes from secure configuration.
- No hardcoded production secret.
- No production fallback secret.
- No real secret committed to Git.
- Production startup fails clearly if a required secret is missing.
- Example configuration contains placeholders only.

If the project uses an HMAC algorithm, verify the configured secret is appropriate for that algorithm.

Do not automatically rotate or replace a user's existing secret.

Do not print secret values during validation.

## 12. Password Security

Inspect existing password handling.

Verify:
- Passwords are never stored as plaintext.
- Existing password hashing uses a suitable adaptive algorithm.
- Password comparison uses the configured encoder.
- Passwords are not logged.
- Authentication errors do not unnecessarily disclose account existence.

Do not change password hash formats without a safe migration strategy.

Do not force users to reset passwords unnecessarily.

## 13. Login Abuse Protection

Review:
- Repeated failed login attempts.
- Login request rate.
- Account enumeration risks.
- Authentication error responses.

Implement a simple, bounded rate limit if missing.

Avoid permanent account lockout without recovery.

Do not introduce CAPTCHA or external services in this milestone.

## 14. Logout and Session Expiration

Inspect existing behavior.

Requirements:
- Web logout clears application authentication state.
- WebSocket connection is closed or invalidated appropriately.
- Expired tokens trigger a controlled unauthenticated state.
- Stale requests do not restore authenticated UI.
- Session expiration does not cause infinite redirects.

Important:
Stateless JWT logout does not automatically revoke an already issued token.

Do not claim server-side revocation unless the repository implements it.

Do not introduce a complex token blacklist solely for this milestone.

Document remaining JWT revocation limitations.

---

# PART D — AUTHORIZATION & DATA ACCESS

## 15. Object-Level Authorization

Review all relevant REST endpoints for IDOR/BOLA vulnerabilities.

Verify ownership or membership for:
- User profile updates.
- Friend requests.
- Friend removal.
- DIRECT conversations.
- GROUP conversations.
- Message history.
- Message actions.
- Reactions.
- Attachments.
- Notifications.
- Location settings.
- Nearby discovery.

Never trust userId, ownerId or recipientId supplied by the client as proof of authorization.

Use the authenticated principal.

## 16. DIRECT Chat Authorization

Verify:
- Only authorized participants can read a conversation.
- Only authorized participants can send messages.
- Only authorized participants can access attachments.
- Friendship rules are enforced according to existing business policy.
- Existing conversation reuse does not bypass authorization.

Do not change established message retention rules.

## 17. GROUP Chat Authorization

Verify:
- Only current authorized members can access protected group data.
- Only permitted roles can update group settings.
- Only the owner or permitted role can delete a group.
- Removed members cannot continue accessing protected history if current policy forbids it.
- Group deletion cannot be triggered by unrelated users.

Preserve existing owner-only deletion rules.

## 18. Message Actions

Verify authorization for:
- Editing, if supported.
- Deleting, if supported.
- Replying.
- Reactions.
- Attachment retrieval.

Follow existing business rules.

Do not invent new permissions.

## 19. Notifications Authorization

Verify:
- Notification list is scoped to the authenticated user.
- Unread count is scoped to the authenticated user.
- Mark-as-read only affects owned notifications.
- Notification references do not bypass chat authorization.
- Notification realtime delivery is recipient-specific.

Do not expose private notification content across users.

---

# PART E — WEBSOCKET SECURITY

## 20. WebSocket Authentication

Inspect existing STOMP/WebSocket security.

Verify:
- Connection authentication.
- Token validation.
- Principal binding.
- Token expiration behavior.
- Reconnection behavior.
- Unauthorized connection rejection.

Do not assume REST authentication automatically secures WebSocket subscriptions.

## 21. Subscription Authorization

Verify authorization for:
- Conversation topics.
- Group topics.
- User notification queues.
- Presence destinations.
- Typing destinations.

A user must not be able to subscribe to another user's private data.

Check the actual inbound STOMP authorization mechanism.

Do not rely only on frontend subscription restrictions.

## 22. WebSocket Message Authorization

Verify:
- Sender identity comes from authenticated context.
- Client cannot impersonate another user.
- Client cannot publish to unauthorized conversations.
- Group membership is checked where required.
- Private events are not broadcast publicly.
- User-specific notifications use trusted recipient routing.

Preserve existing event contracts.

## 23. WebSocket Abuse Prevention

Inspect:
- Message frequency.
- Typing event frequency.
- Presence updates.
- Subscription volume.
- Payload size.

Add bounded protections where justified.

Do not introduce complex distributed infrastructure.

---

# PART F — NEARBY LOCATION PRIVACY

## 24. Nearby Privacy Audit

PROMPT_036 is completed.

Verify that its privacy guarantees remain intact.

Inspect:
- Location update APIs.
- Nearby search APIs.
- Map marker payloads.
- Profile responses.
- WebSocket events.
- Logging.
- Database query behavior.

## 25. Precise Location Protection

Requirements:
- Do not expose another user's exact coordinates through public APIs.
- Do not include precise coordinates in map marker metadata.
- Do not expose location through notifications.
- Respect discoverability opt-in.
- Respect blocking and privacy settings.
- Exclude ineligible users from Nearby results.

Check whether repeated queries, exact distance values or small-radius searches could reveal private positions.

Do not assume simple coordinate rounding or random jitter is sufficient.

If a weakness is found, apply a privacy-preserving approach consistent with the existing architecture.

Do not redesign Nearby UX unnecessarily.

## 26. Location Update Authorization

Verify:
- Only authenticated users can update their own location.
- Client cannot update another user's coordinates.
- Location payloads are validated.
- Invalid coordinates are rejected.
- Location update frequency is bounded where needed.
- Logs do not expose sensitive coordinates unnecessarily.

Do not add continuous background tracking.

---

# PART G — SECURE IMAGE & ATTACHMENT ACCESS

## 27. Upload Validation

Inspect the existing attachment pipeline.

Verify:
- Maximum upload size.
- Allowed content types.
- Server-side file type verification.
- Safe filenames.
- Safe storage paths.
- File ownership metadata.
- Error handling.

Do not trust client-provided MIME type or filename alone.

Use a bounded allowlist of supported image formats.

Avoid adding new media types in this milestone.

## 28. Download Authorization

Verify:
- Attachment access requires appropriate authentication.
- Conversation membership/authorization is checked.
- Guessing an attachment ID does not grant access.
- Private file paths are not exposed.
- JWT tokens are not placed in public image URLs.
- Download headers are safe.

Do not change the current storage architecture unless a verified vulnerability requires it.

## 29. File Handling Safety

Review:
- Path traversal.
- Dangerous filenames.
- Oversized files.
- Unexpected file contents.
- Unsafe content disposition.
- Unsupported image formats.
- Temporary file cleanup.

Do not claim malware scanning unless an actual scanner exists.

Do not introduce a third-party storage provider.

---

# PART H — RATE LIMITING & ABUSE PREVENTION

## 30. Rate Limiting Audit

Inspect existing limits before adding new ones.

Prioritize:
1. Login.
2. Registration.
3. Friend requests.
4. User search.
5. Nearby search.
6. Location updates.
7. Message sending.
8. Image uploads.

Apply limits only where justified.

## 31. Rate Limiting Design

For the current modular monolith, prefer a small, maintainable solution.

Requirements:
- Clear limit scope.
- Defined time window.
- Correct authenticated-user or client identity handling.
- Bounded memory use.
- Expiration/cleanup.
- HTTP 429 when appropriate.
- Safe Retry-After header where applicable.
- Consistent API error format.

Do not trust arbitrary X-Forwarded-For headers unless a trusted proxy configuration is established.

Do not introduce Redis unless existing infrastructure already requires it.

Document that in-memory rate limiting is per application instance and not a distributed guarantee.

## 32. Friend Request Abuse

Verify:
- Duplicate requests are rejected safely.
- Requests to self are rejected.
- Existing friendship rules remain intact.
- Rate limiting does not corrupt relationship state.
- Repeated failed attempts do not leak private information.

## 33. Messaging Abuse

Verify:
- Message length limits.
- Empty message validation.
- Excessive send frequency.
- Oversized payload rejection.
- Existing chat authorization.

Do not introduce aggressive limits that break normal conversation.

Use reasonable, configurable defaults and document them.

---

# PART I — INPUT VALIDATION & ERROR HANDLING

## 34. Request Validation

Inspect existing DTO validation.

Verify:
- Required fields.
- String length limits.
- Numeric ranges.
- UUID/ID formats where applicable.
- Enum values.
- Pagination bounds.
- Nearby radius bounds.
- Coordinates.
- Upload metadata.

Prefer existing Jakarta Bean Validation conventions.

Do not duplicate validation logic unnecessarily.

## 35. Safe Error Responses

Review the global exception handler.

Requirements:
- Consistent error response.
- Appropriate HTTP status.
- No stack traces in production responses.
- No SQL details.
- No secret values.
- No internal filesystem paths.
- No unnecessary user enumeration.

Preserve current API error contracts where possible.

## 36. Web Error UX

Improve only missing or broken cases.

Handle:
- 401 Unauthorized.
- 403 Forbidden.
- 413 Payload Too Large.
- 429 Too Many Requests.
- Network failures.
- Expired sessions.

Requirements:
- Clear messages.
- No infinite redirect loops.
- No duplicate error toasts.
- Preserve recoverable form input.
- Accessible error feedback.

Do not redesign all forms.

## 37. XSS & Content Rendering

Inspect:
- Message text rendering.
- Profile names.
- Group names.
- Notification previews.
- User search results.
- Rich text, if present.

Avoid unsafe HTML injection.

If HTML rendering is necessary, verify appropriate sanitization.

Do not render untrusted content through dangerouslySetInnerHTML without a justified safe handling strategy.

---

# PART J — PRODUCTION CONFIGURATION

## 38. Environment Configuration

Inspect:
- application.yml.
- application.properties.
- Environment-specific profiles.
- Docker Compose.
- .env.example.
- Web environment variables.
- Git ignore rules.

Verify:
- Production secrets are not hardcoded.
- Required variables are documented.
- Missing secrets cause clear startup failures.
- Local development remains usable.
- No real credentials are committed.

Do not overwrite existing local .env files.

Do not remove useful explanatory comments.

## 39. CORS

Review current CORS configuration.

Requirements:
- Explicit allowed origins in production.
- No wildcard origins with credentialed requests.
- Required methods and headers only.
- WebSocket origin handling reviewed separately.
- Local development origins remain supported in development configuration.

Do not use allow-all CORS as a production shortcut.

## 40. Spring Security Production Settings

Review:
- Public endpoints.
- Protected endpoints.
- CSRF strategy.
- Session policy.
- Security headers.
- Error responses.
- WebSocket endpoint exposure.

Do not disable security features blindly.

Document why any endpoint is public.

## 41. Health Checks

If Spring Boot Actuator exists:
- Review exposed endpoints.
- Keep sensitive endpoints protected.
- Expose only necessary health information publicly.

If no health check exists:
- Reuse the existing HealthController where sufficient.
- Avoid adding Actuator solely for a duplicate health endpoint.

Do not expose environment variables or sensitive configuration.

## 42. Logging

Review application logs.

Prevent logging:
- Passwords.
- JWT tokens.
- Authorization headers.
- Private message bodies.
- Sensitive user data.
- Precise location coordinates.
- Database credentials.

Preserve useful operational diagnostics.

Avoid logging full request/response bodies for sensitive endpoints.

## 43. Dependency Security

Inspect Backend and Web dependency manifests.

Use available dependency audit tooling when possible.

Prioritize verified vulnerabilities in runtime dependencies.

Do not blindly upgrade Spring Boot, React or other major dependencies.

Avoid large dependency migrations in this milestone.

Document unresolved findings and compatibility risks.

---

# PART K — TESTING

## 44. Backend Security Tests

Add targeted tests for verified security requirements.

Test:
1. Missing JWT.
2. Expired JWT.
3. Invalid JWT signature.
4. Unauthorized profile update.
5. Cross-user friend request manipulation.
6. Unauthorized DIRECT conversation access.
7. Unauthorized GROUP conversation access.
8. Unauthorized message action.
9. Unauthorized attachment download.
10. Cross-user notification access.
11. Unauthorized WebSocket subscription.
12. WebSocket sender impersonation.
13. Nearby opt-out.
14. Precise coordinate exposure.
15. Invalid location update.
16. Invalid upload type.
17. Oversized upload.
18. Path traversal attempts.
19. Login rate limiting.
20. Friend request rate limiting.
21. User search rate limiting.
22. Message validation.
23. Safe error responses.
24. Transaction rollback behavior where relevant.

Only test features actually present.

Use appropriate integration tests where security depends on framework configuration.

## 45. Web Security Tests

Test:
1. Expired session handling.
2. Logout cleanup.
3. Unauthorized route behavior.
4. 403 error handling.
5. 429 rate limit feedback.
6. Upload validation errors.
7. Invalid user content rendering.
8. WebSocket reconnect after authentication failure.
9. Notification privacy.
10. Nearby permission and privacy states.
11. Light/Dark themes.
12. Responsive layouts.

Do not claim tests were executed unless they were actually run.

## 46. Regression Tests

Verify existing functionality:
- Login/logout.
- Friends.
- Friend requests.
- Nearby.
- Map/List views.
- DIRECT chat.
- GROUP chat.
- Group deletion.
- Message pagination.
- Unread/read cursor.
- Typing and presence.
- Reply and reactions.
- Image sharing.
- Notifications.
- Realtime reconnect.
- Theme switching.
- Responsive navigation.

Do not modify Mobile.

## 47. Manual Security Verification

Use at least two local test accounts.

Scenario A — Unauthorized Chat:
- Account A creates or joins a conversation.
- Account B attempts to access a conversation it is not authorized to view.
- Verify access is denied.

Scenario B — Notifications:
- Account A attempts to access Account B's notification resource.
- Verify access is denied.

Scenario C — Attachments:
- Account A uploads a private image.
- An unauthorized account attempts to access it.
- Verify access is denied.

Scenario D — Nearby:
- Disable discoverability.
- Verify the account does not appear in Nearby results.
- Verify no precise location leaks through API responses.

Scenario E — Rate Limiting:
- Send a controlled number of test requests.
- Verify the configured limit is enforced.
- Verify normal usage remains possible.

Scenario F — Session Expiration:
- Use an expired or invalid token.
- Verify the Web returns to an appropriate unauthenticated state.
- Verify private data is not displayed from stale state.

Do not perform destructive tests against production.

Do not run uncontrolled load tests.

## 48. Validation Commands

Inspect repository scripts and run:
- Backend compile.
- Relevant Backend tests via Maven Wrapper.
- Web production build.
- Web tests.
- Web typecheck/lint if available.

If migrations are added:
- Validate Flyway on PostgreSQL/PostGIS.

If dependency audit tools are available:
- Record the results.

Report failures honestly.

Do not run Mobile build/tests.

---

# PART L — IMPLEMENTATION PLAN

## 49. Phase 1 — Security Audit

- Inspect Backend and Web.
- Review existing controls.
- Classify findings.
- Rank severity.
- Identify minimal fixes.
- Produce audit summary.

Do not begin broad refactoring.

## 50. Phase 2 — Critical Authorization Fixes

Prioritize verified:
- Cross-user data access.
- Unauthorized chat access.
- WebSocket subscription leaks.
- Private attachment exposure.
- Nearby precise location leaks.

Add regression tests.

## 51. Phase 3 — Authentication Hardening

- Review JWT validation.
- Review secret configuration.
- Review logout/session expiry.
- Fix verified weaknesses.
- Add tests.

## 52. Phase 4 — Abuse Prevention

- Review existing rate limits.
- Add missing targeted protections.
- Add safe 429 responses.
- Add tests.

## 53. Phase 5 — Validation and Error UX

- Fix unsafe input handling.
- Fix unsafe error responses.
- Improve Web feedback.
- Preserve existing UI.

## 54. Phase 6 — Production Configuration

- Review environment profiles.
- Review CORS.
- Review health checks.
- Review logging.
- Review dependency security.

Do not implement deployment infrastructure.

## 55. Phase 7 — Regression

- Run relevant tests.
- Run Web build.
- Run Backend validation.
- Review API compatibility.
- Document unresolved risks.

---

# PART M — ACCEPTANCE CRITERIA

## 56. Completion Checklist

PROMPT_040 is complete when:

- [ ] Security audit is documented.
- [ ] Existing protections are identified and reused.
- [ ] Verified Critical and High vulnerabilities in scope are fixed or explicitly reported as blockers.
- [ ] JWT validation is reviewed.
- [ ] JWT secret handling is safe.
- [ ] Object-level authorization is verified.
- [ ] WebSocket authorization is verified.
- [ ] Nearby privacy guarantees remain intact.
- [ ] Private attachment access is protected.
- [ ] Rate limiting is reviewed and targeted protections are implemented where missing.
- [ ] Request validation is reviewed.
- [ ] Production error responses do not expose internals.
- [ ] Web handles 401/403/429 appropriately.
- [ ] Production CORS configuration is reviewed.
- [ ] Sensitive logs are reviewed.
- [ ] Production configuration does not hardcode secrets.
- [ ] Relevant security tests pass.
- [ ] Existing chat and notification features remain functional.
- [ ] Backend build and relevant tests pass.
- [ ] Web build and relevant tests pass.
- [ ] Mobile source remains unchanged.
- [ ] Remaining security limitations are documented.

A checklist item may be satisfied by verifying that a correct implementation already exists.

Do not modify working code merely to satisfy a checklist.

## 57. Final Report

Provide a Vietnamese report containing:

1. Initial security audit.
2. Findings grouped by severity.
3. Already implemented protections.
4. Verified vulnerabilities.
5. Implemented fixes.
6. Files changed.
7. API compatibility impact.
8. Database migrations, if any.
9. JWT and authentication review.
10. Authorization review.
11. WebSocket security review.
12. Nearby privacy review.
13. Attachment security review.
14. Rate limiting implementation.
15. Production configuration changes.
16. Backend test results.
17. Web build/test results.
18. Manual verification actually performed.
19. Regression results.
20. Remaining risks and limitations.
21. Recommended next milestone.

For each security finding, state:
- Status: FIXED, VERIFIED SAFE, OPEN or NOT TESTED.
- Evidence.
- Test coverage.
- Residual risk.

Do not claim a system is production-secure solely because automated tests pass.

End with exactly one of:

PROMPT_040 COMPLETE

or

PROMPT_040 NOT COMPLETE

Only report COMPLETE when the acceptance criteria pass and no unresolved Critical or High finding remains within the agreed scope.