# Admin portal, super administrator, and email password recovery

## Administration

Open `/admin` for the separate administration portal. `/admin/users` lists users;
the old `/app/admin/users` path redirects there. Both `ADMIN` and `SUPER_ADMIN`
can view counts and moderate ordinary users. Regular users cannot access its APIs.

The overview shows total, active, self-deactivated, blocked, and online accounts,
with a measurement timestamp. It refreshes every 15 seconds while the page is visible.
Online means a distinct active account with an authenticated realtime connection on
the current backend instance; multiple tabs/devices count once. It does not mean
all users who still have an unexpired login token. This follows the existing single
backend/simple-broker deployment model; multiple instances would need shared presence.
Counts include administrator accounts and the disabled migration seed until configured.

`SUPER_ADMIN` additionally sees **Message user** for other active accounts. This
opens an ordinary direct conversation without needing friendship and without the
five-message non-friend quota. Normal conversation membership, message validation,
and REST/WebSocket burst limits remain enforced. The super administrator has no
new permission to read conversations in which they are not a participant.

`ADMIN` and `SUPER_ADMIN` accounts are protected from blocking/self-deactivation
through the user moderation endpoints. Role changes remain deployment-operator actions.

## Initial super administrator

Flyway `V21__super_admin_and_password_reset.sql` adds the role and inserts a reserved
`geochat_super_admin` account with status `LOCKED`, password login disabled, and an
unusable placeholder password. There is no shared/default login password. If the
username already belongs to an existing account, the migration never promotes it;
bootstrap fails rather than taking over that account.

Configure these variables for the first deployment, using a new unique password:

```dotenv
SUPER_ADMIN_BOOTSTRAP_ENABLED=true
SUPER_ADMIN_USERNAME=your_operator_username
SUPER_ADMIN_EMAIL=operator@example.com
SUPER_ADMIN_PASSWORD=<unique-password-at-least-16-characters>
```

Usernames use 3–50 letters, digits, or underscores. Passwords may contain at most
72 UTF-8 bytes. The startup bootstrap locks the seed
row, renames it if needed, saves a BCrypt password, and activates the account. It
does not change credentials or reactivate a configured super administrator on
later starts. After successful setup, set `SUPER_ADMIN_BOOTSTRAP_ENABLED=false`,
remove `SUPER_ADMIN_PASSWORD` from the deployment environment, and restart.

Compose passes these variables from the ignored `.env` file. For a backend started
directly from an IDE or Maven, set the process environment explicitly; Spring does
not automatically load Compose's `.env`. Never commit real credentials.

No deployment account is activated merely by building or running the test suite.

## SMTP password recovery

The sign-in page links to `/forgot-password`. `/reset-password` consumes the email
link. New labels and feedback support English and Vietnamese. Recovery uses the
email already saved in the account; username-only accounts must add an email in
Profile before losing access. Google-only accounts continue using Google sign-in;
email recovery does not add a password sign-in method to them.

Configure your SMTP provider, for example STARTTLS on port 587:

```dotenv
PASSWORD_RESET_ENABLED=true
PASSWORD_RESET_WEB_ORIGIN=https://chat.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=<provider-username>
SMTP_PASSWORD=<provider-password-or-app-password>
SMTP_FROM=GeoChat <noreply@example.com>
SMTP_AUTH=true
SMTP_STARTTLS=true
SMTP_SSL=false
```

The Web origin is configured by the operator, never derived from the request Host
header. It must contain only scheme, host, and optional port. Use HTTPS for real
deployments. For providers using implicit TLS on port 465, set `SMTP_SSL=true` and
`SMTP_STARTTLS=false`. TLS certificate hostname checks are enabled. SMTP connect,
read, and write timeouts are five seconds. Credentials/from addresses must be
authorized by your provider; configure its SPF/DKIM/DMARC as appropriate.

Without enabled recovery, an SMTP host, sender address, and mail sender, the Web
page reports recovery unavailable. SMTP delivery errors are recorded without
logging addresses, tokens, message contents, or provider exception details.

The forgot response is neutral for unknown emails, blocked accounts, and Google-only
accounts. Account lookup and SMTP run on a bounded background queue, so delivery
timing does not reveal account existence in the HTTP response. Requests are limited
to five per IP and three per normalized email per 15 minutes; reset submissions
have a separate ten-per-IP-per-minute quota. These are per-backend-instance guards.
At queue/provider saturation, a user may need to retry after the cooldown.

Each reset token uses 32 random bytes; only its SHA-256 hash is stored. Links expire
after 15 minutes and are single-use; a newer request replaces earlier links. The
URL places the token in a fragment, and the Web page immediately removes it from
the address bar. The backend receives it only in the reset POST body, whose DTO
redacts its logging representation. Reset verifies the saved email, account status,
and authentication version again under locks. Email changes, account blocking,
previous password resets, and consumed/expired links make a link unusable.

On success, the password changes, reset tokens are deleted, and `auth_version`
increments. Existing JWTs and sockets are revoked; the current browser also signs
out. Reset never logs the user in, unblocks an account, or reverses self-deactivation.

API additions:

- `GET /api/v1/admin/overview`
- `POST /api/v1/admin/users/{id}/conversation` (`SUPER_ADMIN` only)
- `GET /api/v1/auth/password/config`
- `POST /api/v1/auth/password/forgot` with `{ "email": "..." }`
- `POST /api/v1/auth/password/reset` with `{ "token": "...", "password": "..." }`

Deploy the backend with V21 and the Web build together. Add secrets locally using
the variable names in `.env.example`. No live SMTP credentials or deployment
passwords are supplied by this change.

## Verification

- Full Backend regression: 174 passed, 4 optional PostgreSQL tests skipped.
  Final password-recovery checks, including blocked accounts: 4 passed.
- Full Web regression: 212 passed. After final recovery/session and messaging UI
  checks, the 15 affected tests and the production/TypeScript build passed.
- V21 migration was exercised in isolated H2 PostgreSQL mode, including reserved
  username collisions, disabled seed defaults, and reset-token constraints.
- SMTP was tested with a mock mail transport. Real email delivery requires your
  provider credentials; it was not attempted. Docker Desktop's Linux engine pipe
  was unavailable, so live PostgreSQL/container checks were not run.
- No application database or Docker volumes were modified. Native Mobile builds
  and physical-device checks were skipped; no real device was available.

Local evidence is under the ignored `artifacts/account-lifecycle/admin-reset-*`.
