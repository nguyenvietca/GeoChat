# PROMPT 040 — Initial security audit

Audit date: 2026-10-16. This document records repository evidence before hardening changes.

| Area | Current state | Finding | Severity | Minimal action |
|---|---|---|---|---|
| JWT | Signed JJWT tokens, expiry validation, 32-byte minimum, authenticated user reloaded | Default secret exists in the base configuration and could be used accidentally in production | High | Add a production profile that requires `JWT_SECRET`; retain an explicit local-only default |
| Passwords | BCrypt hashing and generic bad-credential response | No password disclosure or plaintext storage found | Verified safe | Keep existing encoder and response |
| REST authorization | Principal-derived user identity and service membership/ownership checks | No verified cross-user bypass found in reviewed profile, friend, chat, group, notification and location paths | Verified safe | Preserve tests and service checks |
| WebSocket | JWT on CONNECT, principal binding, destination membership checks and expiry scheduling | The verified JWT was retained in STOMP session attributes; framework DEBUG logging could therefore print the raw token | High | Retain only username and expiry in the session, use the authenticated principal, rate-limit inbound actions and keep messaging logs at INFO in production |
| Nearby privacy | Discoverability opt-in, 24-hour freshness, coarse 0.05° area, rounded distance, bounded queries | Current user's exact coordinates are returned only to that authenticated user; other users receive coarse areas | Verified safe | Keep behavior; document inference risk from repeated observations |
| Attachments | Authenticated download, conversation membership, random storage key, normalized path, MIME/magic decoding and re-encoding | No verified IDOR/path traversal found | Verified safe | Keep validation and no-store/nosniff response |
| Rate limiting | Nearby search/update only, bounded in-memory guard | Login, registration, friend request, user search and message endpoints have no request-frequency protection | High | Add bounded per-instance fixed-window filter with 429 and Retry-After |
| Validation | Bean validation plus service checks and multipart size bounds | Login fields have no upper bounds | Medium | Add bounded login field lengths |
| Error handling | Global JSON errors hide unexpected internals | Security entry point uses servlet `sendError`, which may return a non-API body | Medium | Return the existing JSON envelope for 401/403 |
| Production config | Explicit CORS allowlist; no wildcard credentials; health only is public | No production profile requiring DB credentials, JWT secret and origins | Medium | Add `application-prod.yml` with required placeholders and conservative logging |
| Web session | 401 clears local token and disconnects sockets on explicit logout | JWT remains in localStorage and stateless logout cannot revoke issued tokens | Open, Low | Document residual risk; avoid broad auth rewrite |
| XSS | React text rendering; no `dangerouslySetInnerHTML` found | No verified stored/reflected XSS sink found | Verified safe | Preserve text rendering |
| Health/Actuator | Minimal `/api/health`; no Actuator dependency | No sensitive actuator exposure | Not applicable | Keep existing health endpoint |

No Critical issue was identified. The implementation phase addresses the verified High and Medium findings without changing Mobile contracts.

