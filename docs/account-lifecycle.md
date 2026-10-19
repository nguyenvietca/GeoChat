# Account deactivation and administrator blocking

The Web client exposes **Deactivate account** in Settings. The user confirms the
consequences and verifies their current password, or completes Google verification
for a Google-only account. No account, friendship, group, or message data is deleted.
Search, Nearby discovery, and public profile/avatar access exclude inactive users.
Historical conversations still retain their messages and sender information.
Push delivery is suppressed while an account is self-deactivated or blocked.

Users sign in normally with their password or linked Google account. An `INACTIVE`
account remains deactivated after sign-in. The Web client displays a mandatory
reactivation screen with an explicit confirmation and a sign-out option; normal
navigation, messages, and notification connections are unavailable until activation.
The restricted session can only read its own profile and confirm reactivation.
The backend grants it `ROLE_INACTIVE`, independently restricting all other protected
REST endpoints and rejecting STOMP connections, SEND, and SUBSCRIBE. Public login
and OAuth protocol endpoints remain available. The confirmation endpoint increments
`auth_version` and returns a fresh full-access JWT, invalidating the restricted JWT.
An administrator-blocked account cannot sign in or confirm activation.

| Database status | Meaning | Who can restore access? |
| --- | --- | --- |
| `ACTIVE` | Normal access | — |
| `INACTIVE` | User chose to deactivate | User, after signing in and confirming activation |
| `LOCKED` | Administrator blocked access | Administrator must unblock first |

`self_deactivated_at` is retained while blocked. Unblocking a previously
self-deactivated account restores `INACTIVE`; the user must then sign in and confirm activation.
Nearby sharing remains off after restoration and must be enabled again by the user.

Every lifecycle transition increments `auth_version`. REST and STOMP authentication
check the current account status, user ID, and token version. Revoked JWTs remain
invalid after reactivation or unblocking. Existing local WebSocket sessions close
after the transaction commits; STOMP SEND/SUBSCRIBE also rechecks current access.
This follows the existing single-backend-instance/simple-broker deployment model;
multiple backend instances would additionally require distributed socket revocation.
Optimistic `row_version` checks also prevent an overlapping profile or location
update from overwriting a new block or restoring an obsolete token version.

## Administrator access

The separate `/admin` portal, `SUPER_ADMIN` bootstrap, and email password recovery
are documented in [admin-and-password-recovery.md](admin-and-password-recovery.md).

`USER` is the default role, including for existing accounts migrated by V20 and for
new password/Google registrations. Signup and profile APIs cannot assign roles.
No default password is created. V21 adds a disabled `SUPER_ADMIN` seed; configure
it using the one-time environment bootstrap described in the linked guide.

The deployment operator must grant `ADMIN` to a verified existing account using
their database administration connection. For example, substitute the intended
username and check that exactly one row is returned:

```sql
BEGIN;
UPDATE users
SET role = 'ADMIN', auth_version = auth_version + 1,
    row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
WHERE username = 'verified_operator_username' AND status = 'ACTIVE'
RETURNING id, username, role;
COMMIT;
```

The operator must sign in again. Web Settings then shows **Manage users**, available
at `/admin/users`. The backend independently enforces administrator roles on every
`/api/v1/admin/**` request. The page supports paginated search and blocking/unblocking
with a required reason of 1–500 characters. Admin accounts cannot be blocked or
self-deactivated through these endpoints; transfer/demote the role through the
deployment operator first. Operator role changes should be made during maintenance
and increment both `auth_version` and `row_version` as above.

`account_actions` records actor ID, target ID, action, reason, and time in the same
transaction as the state change. It has no update/delete application API. Audit IDs
are retained independently of user rows. Block reasons are visible only to admins;
blocked users see a general message directing them to an administrator.

## API additions

- `POST /api/v1/users/me/deactivate` — authenticated; `{ "password": "..." }`.
- `POST /api/v1/users/me/reactivate` — requires an authenticated `INACTIVE` session; explicit confirmation returns a fresh full-access application JWT.
- `POST /api/v1/auth/google/deactivate` — authenticated; begins session-bound Google verification.
- `GET /api/v1/admin/users?query=...&page=0` — admin; 20 records per page.
- `POST /api/v1/admin/users/{id}/block` and `/unblock` — admin; `{ "reason": "..." }`.

Google completion preserves the existing cookie/state/nonce/PKCE checks and
single-use redemption. Its response adds `deactivated`; own-profile responses add
`role`. Other existing fields and Mobile source are preserved. New Web labels and
known API messages are configured in both `i18n/en.ts` and `i18n/vi.ts`.

Normal password sign-in uses existing IP/account attempt limits, including for
deactivated accounts. Deactivation shares account password-attempt limits. Activation
confirmation, Google actions, and admin mutations use the bounded per-instance rate guard.

Deploy/restart the backend to apply Flyway `V20__account_lifecycle.sql`, then deploy
the Web build. V20 backfills `self_deactivated_at` for existing `INACTIVE` users and
preserves existing statuses. Do not manually change status without also updating
the lifecycle metadata and revocation version.

## Verification

The tests cover normal password/Google sign-in without implicit activation,
mandatory activation confirmation, restricted REST and STOMP access, full-access
JWT issuance, permanent old-token rejection, administrator block behavior, audit
records, and stale profile-write rejection.

V20 SQL was exercised against isolated H2 in PostgreSQL mode. Live PostgreSQL
checks require the optional database verification environment. Native Mobile builds
and physical-device checks are outside this Web change; no real device is available.
No native Mobile source was changed. Local logs are under the git-ignored
`artifacts/account-lifecycle/`.
