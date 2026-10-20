# Email and Password Authentication

## Status

The credential flow is implemented locally. No migration has been applied to
Neon, and no existing account or record has been modified. Do not deploy this
change against an unmigrated database.

## Modes

- `AUTH_MODE=credentials` enables email/password registration and login.
- Production defaults to credentials. Vercel always uses credentials even if
  `AUTH_MODE=demo` is mistakenly set.
- `AUTH_MODE=demo` is a local-only compatibility mode for the old user selector.
  Development/tests default to demo unless credentials are explicitly selected.
  Never expose demo mode to other people or bind it to a public network.
- To review the previous UI against the current, unmigrated Neon database, run
  the local server bound to 127.0.0.1 with `AUTH_MODE=demo`. This does not upgrade
  identity verification in the existing public deployment.

## Before Public Rollout

1. Back up existing Neon data and test the migration on a separate staging DB.
2. Apply the additive migration in `prisma/postgres-migrations/20261009000000_add_credentials` only after
   review and explicit approval. It adds credential/session/attempt tables;
   existing usernames, user IDs, records, friends, and ratings are untouched.
   Prisma is configured to use `prisma/postgres-migrations`; do not use the old
   SQLite history in `prisma/migrations`. Check the existing PostgreSQL migration
   status on staging before deploying, rather than replaying the initial schema.
3. Decide the owner of each legacy user through a trusted administrator. Public
   registration never attaches to an existing username and never claims orphaned
   records. There is deliberately no self-service "claim any user" endpoint.
4. Provision credentials for confirmed legacy owners using an administrator-only
   [local administrator command](legacy-user-handover.md) on staging first.
   Existing IDs remain unchanged. Forgotten-password recovery still needs implementation; do not
   paste passwords or session tokens into this chat or commit them to Git.
5. Configure transactional email for address verification and password recovery.
   Current registration proves knowledge of a password, not ownership of the
   supplied mailbox. Email verification/reset are not implemented yet.
6. Enable platform-wide/IP throttling before opening registration publicly.
   Current DB limits are per normalized email and purpose: 8 login attempts or
   5 signup attempts per 15 minutes. Signed-in friend-request attempts are limited
   to 10 per owner per 15 minutes in credential mode (local demo is unthrottled).
   Password changes are limited to 5 per owner per 15 minutes.
   Distributed random-email abuse is not yet
   blocked by this account-level limiter.
7. Set `AUTH_MODE=credentials`, use HTTPS, deploy only after staging acceptance,
   and verify that the legacy user-ID cookie cannot access another user's data.

## Security Properties

- Passwords use Node's scrypt with random 16-byte salts, N=32768, r=8, p=3,
  and constant-time hash comparison. This parameter set is listed in the
  [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Sessions use random 32-byte opaque tokens. Only SHA-256 digests are stored in
  the DB. Cookies are HttpOnly, SameSite=Lax, HTTPS-only in credential production,
  and expire after 14 days. Logout deletes the presented session, not all sessions.
- Credential mode does not fall back to the numeric user-ID cookie or demo
  actions, including when a session expires or an auth DB operation fails.
- New owner, credential, and initial session creation are transactional.
- Signed-in password changes require the current password, lock the owner's row,
  and revoke all previous sessions transactionally. Login uses the same row lock
  and rechecks the current hash, preventing issuance with a stale password hash.
- Logout clears this device's cookies even if DB revocation fails. In that case
  the server-side token may remain valid until its expiry; the error is not
  silently treated as successful server revocation. The users page displays an
  incomplete-revocation warning after clearing local cookies.
- Login uses a generic failure for unknown email/wrong password and still derives
  a hash for unknown accounts. Database details never appear in form errors.
- Existing record/friend actions continue using their centralized owner checks.
- Expired session and attempt rows should be cleaned up periodically by an
  administrator-owned maintenance job. No cleanup is scheduled by this change.

## Verification

Auth mutation tests use Prisma mocks; complete registration/login/change/logout
flows also run against an in-memory PGlite DB through a narrow test query adapter.
The PostgreSQL migration history, rollback, legacy-owner protection, session
revocation, and limiter SQL are verified without a Neon connection. This does not
validate the real Prisma/Neon adapter or multi-server contention; staging is still
required. `npm.cmd run verify` overrides DB URLs with localhost dummy values.
