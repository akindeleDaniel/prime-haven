# Prime Haven Properties

Fictional Nigerian property portfolio project. Concept project: listings are fictional.

## Local authentication slice

Implemented: User/Session models, first-admin initialization, bcrypt hashing, sign-in/out, current user,
PostgreSQL session expiration/revocation, agent invitations/activation and explicit Next.js BFF handlers.
Password recovery and authenticated password change are implemented. Account deactivation, listings and
authentication UI remain outside these slices.

1. Install each app's lockfile with `npm ci` in `backend` and `frontend`.
2. Copy the `.env.example` files to `backend/.env` and `frontend/.env.local`. Use local `prime_haven_dev`
   PostgreSQL credentials. Set the same random `BFF_SHARED_SECRET` (32 random bytes or more) in both
   server environments; never use `NEXT_PUBLIC_*` or commit environment files. Generate a value with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Configure the backend ZeptoMail send token and a verified sender address to deliver invitations. Automated
   tests inject a mock sender and never contact ZeptoMail.
3. From `backend`, run `npm run db:generate`, then `npm run db:migrate:local`. The guarded command
   confirms named loopback development PostgreSQL, creates a custom-format `pg_dump` backup under the
   OS temporary directory, then applies additive migrations. PostgreSQL tools must be on PATH.
   Keep the backup protected and move it to protected storage for durable retention. No reset is used.
4. From an interactive local terminal in `backend`, run `npm run admin:init`. Enter name, email,
   international phone and the hidden password twice. There is no default password/public registration.
   Bootstrap refuses if any Administrator exists, including an inactive one; it never replaces accounts.
5. Run `npm run dev` in both apps. Defaults: Next.js `http://localhost:3000`, Express `http://localhost:3001`.
   Explicit `AUTH_ALLOW_LOCAL_HTTP=true` permits only loopback HTTP. Deployed origins require HTTPS.

The current workspace's ignored local environment files have matching transport configuration. The real local
administrator remains for the owner to initialize interactively; automated tests create accounts only inside an
isolated test schema. Invitation records are committed before email delivery; delivery failure leaves the account
unactivated and available for an administrator to resend.

Browser calls use `/api/v1/auth/sign-in`, `/api/v1/auth/sign-out` and `/api/v1/me` on Next.js.
POST requires JSON, exact configured `Origin` and `X-Prime-Haven-CSRF: 1`. Sign-in body: `{email,password}`;
sign-out: `{}`. Use same-origin fetch credentials. The custom-header/origin scheme avoids an extra
CSRF-token endpoint; SameSite provides additional protection. Express has no browser CORS allowance.
Administrator invitation handlers use `/api/v1/admin/agents` and `/api/v1/admin/agents/{id}/invitations`;
public activation uses `/api/v1/auth/invitation-acceptances`. They use the same BFF origin/CSRF checks.

Recovery uses `POST /api/v1/auth/password-reset-requests` with `{email}` and always returns the same
202 message for valid known/unknown/ineligible emails. Eligible active, activated accounts receive a
single-use 30-minute reset link built from APP_ORIGIN. Email delivery runs after persistence in the Express
process, outside public response timing; a restart may lose pending delivery and the user can request again
after the 60-second persistent cooldown. Provider failures log only a safe event code. No automatic retry.
`POST /api/v1/auth/password-resets` takes `{token,newPassword}`; `PUT /api/v1/me/password` takes
`{currentPassword,newPassword}` and requires a live session. Both revoke all existing sessions and outstanding
reset links atomically and clear the caller cookie on success. They do not sign in automatically.
The reset email targets `/reset-password`; its UI remains subject to Figma design/approval.

HTTPS cookie: `__Host-ph-session; Path=/; HttpOnly; Secure; SameSite=Strict`, no Domain, seven-day absolute
expiry. Explicit loopback HTTP uses `ph-session` without Secure. Express independently enforces twelve-hour
idle expiry, absolute expiry, revocation, role and current account eligibility. Next forwards only the
cookie credential through server-only transport and strips internal token headers; no general proxy.
See [the implemented authentication transport contract](docs/08_API_CONTRACTS.md#15-implemented-authentication-transport-slice).

## Verification

From `frontend`: `npm run lint`, `npx tsc --noEmit`, `npm run build`.
Then from `backend`: `npm run type-check`, `npm run type-check:tools`, `npm run build`, `npm test`.
On Windows PowerShell with scripts disabled, use `npm.cmd`/`npx.cmd` for these commands.
Tests require local PostgreSQL and the built frontend. They launch real Express/Next servers with ephemeral
credentials, apply the authentication migration in a fresh random `auth_test_*` schema and drop only that
schema afterward. They never truncate/reset the public schema or create a persistent demo administrator.

The coarse request limiter allows 30 sign-in requests/minute per actual backend socket address per process;
BFF clients share a bucket, and caller forwarding headers are ignored. Persistent five-failure/15-minute
account lockout is serialized in PostgreSQL across instances. Deployment-wide abuse controls/proxy trust
still require provider-specific verification. Bcrypt cost 12 uses a minimum of 10 characters and maximum
of 72 UTF-8 bytes; oversized passwords are rejected rather than truncated
([bcrypt documentation](https://github.com/dcodeIO/bcrypt.js)). Security logs contain only event codes,
opaque IDs where appropriate and timestamps. Persistent domain AuditLog and remaining PH-AUTH-001 flows
remain partially implemented: account creation/activation and password recovery/change events persist;
general audit browsing and remaining PH-AUTH-001 flows remain later work. This does not establish full roadmap acceptance.
