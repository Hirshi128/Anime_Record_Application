# Autonomous Progress

## 2026-10-02 - Setup

- Created the repository workflow for recurring local development.
- Initial Git working tree was clean.
- Confirmed lint and build commands exist in package.json.
- Identified cookie-based user selection in src/lib/current-user.ts as an area
  requiring identity and session improvements before wider community use.
- No application behavior or production database was changed during setup.
- Next run: inspect user actions and record ownership; select one bounded,
  testable improvement and record the result here.

## 2026-10-02 - One-Hour Improvement Session

- Started at 14:10 JST. All application changes remain local; no push, deployment,
  migration, or production data writes were performed.
- Fixed stale title suggestions and cancelled-response races. Added keyboard
  selection, IME-aware Enter handling, provider timeouts, and clear failure states.
- Added in-form validation and submission feedback for anime records,
  registration, profiles, and social actions. Real-browser checks revealed native
  form resets affecting selects and checkboxes; controlled forms now cancel reset
  events so a validation failure preserves entered values.
- Added live featured selection counts and client-side three-record limits.
  User-row locks serialize featured mutations and profile changes. Consistent
  lock order and conditional updates handle crossed friend requests and repeated
  acceptance. Added sender-owned pending-request cancellation.
- Added independent pagination for user search and friend lists, case-insensitive
  searches, social-page revalidation, accessible notification text, and Japan-time
  timestamps.
- Added strict PostgreSQL Int ID validation, deletion confirmation, error/404
  pages, keyboard focus styles, reduced-motion support, long-title wrapping, and
  compact mobile genre selection.
- Updated Next.js and eslint-config-next from 16.2.11 to 16.3.8 for the reported
  security fixes. Also applied a compatible fast-uri update. Next.js regenerated
  its own AGENTS.md guidance during startup; that generated change is retained.
- Added an offline PWA fallback and retry. Service Worker caching is limited to
  the static offline page and icon, not user records or profile responses.
- Added Vitest/Testing Library and Playwright checks, with commands in README.md.
  Intermediate verification: 59 unit/component tests passed; desktop and Android
  browser checks covered layouts, scrolling, keyboard selection, cancelled
  deletion, offline recovery, and invalid-input preservation.
- Verification limitation: database mutation tests use Prisma mocks. Real
  PostgreSQL row-lock contention has not been tested against an isolated database.
- Remaining priority: replace cookie-based user selection with actual identity
  verification and a migration plan for existing users. Some Prisma CLI/tooling
  dependency audit findings remain; do not force a major-version downgrade.
- Final verification results are recorded below after the concluding checks.

### Final Verification

- npm.cmd run test: 59 tests passed across 10 files on the final implementation.
- npm.cmd run lint: passed without warnings or errors.
- npm.cmd run build: passed with Next.js 16.3.8.
- Final production dependency audit: 7 findings (1 moderate, 6 high, 0 critical),
  remaining in the Prisma CLI dependency chain. The audit is not fully clean.
- npm.cmd run test:browser: all 12 production-browser checks passed across
  desktop and Android-sized viewports. Screenshots were visually inspected.
- git diff --check: passed. Line-ending normalization notices are informational.
- Completed the implementation session and concluding verification at about
  15:12 JST. The local production preview is available on http://127.0.0.1:3030.

## Log Format

For each meaningful run, append a dated entry with:

- The concrete issue and affected files.
- Implemented behavior and why it helps.
- Verification commands and results, including checks that could not run.
- Remaining decisions or blockers, without secrets or personal data.
- The next useful action.

## 2026-10-08 - User Selection Reading and Focus Order

- Resumed the unverified layout work without changing its colors, button sizes,
  or other existing local edits. Found that CSS order utilities placed existing
  users before registration visually, while DOM/Tab/screen-reader order still
  put the registration form first.
- Moved the existing-user section before registration in the JSX and removed
  the order utilities. Desktop left-to-right and Android top-to-bottom layout
  now follow the same order as keyboard navigation and reading order.
- Changed files this run: src/app/users/page.tsx, tests/users-page.test.tsx,
  tests/browser/entry-layout.spec.ts, and this progress log.
- Added a database-mocked regression test for document and Tab order, plus
  production-browser checks for home action sizing, compact feature cards,
  user-selection layout/focus order, and horizontal overflow.
- Verification: npm.cmd run test passed all 60 tests across 11 files;
  npm.cmd run lint and npm.cmd run build passed. The focused command
  npm.cmd run test:browser -- entry-layout.spec.ts passed all four checks
  across desktop and Android-sized viewports. Inspected home/users screenshots.
  git diff --check passed (line-ending notices only).
- Browser checks read existing users but performed no login, registration,
  record mutation, or production DB writes. Unit tests used Prisma mocks.
  No migrations, commits, push, deployment, or paid services were introduced.
- The temporary production preview server was stopped after verification.
- Remaining: the previous broader layout pass has only focused entry-screen
  browser verification in this run; full social/form browser checks were not
  repeated. Actual identity verification and isolated DB concurrency tests
  remain separate work, not addressed by this layout/accessibility fix.
- Next: inspect the profile/detail primary actions at narrow Android widths,
  preserve SS/S styling, and address only a concrete overflow or focus issue.

## 2026-10-09 - Stable Pending Action Buttons

- Continued the layout review with one bounded issue: ActionButtonForm replaced
  its label with a different-length pending label, changing the button width and
  potentially moving adjacent actions during deletion or social requests.
- Overlay the idle and pending labels in one CSS grid cell so both contribute
  to layout size. Only the visible label contributes to the accessible name;
  pending actions remain disabled. Existing colors, SS/S styling, and all other
  local layout edits are unchanged.
- Changed files: src/app/action-button-form.tsx, src/app/globals.css,
  tests/action-button-form.test.tsx, tests/browser/read-only.spec.ts,
  and docs/autonomous-progress.md.
- Added a mocked component test for idle/pending names, disabled state, and
  restoration after completion. Extended the deletion browser check to hold
  its POST in Playwright and abort it, measuring the same width, height, and
  horizontal position before/during processing. No deletion reaches the server.
- Final verification: npm.cmd run test passed 61 tests in 11 files;
  npm.cmd run lint and npm.cmd run build passed. The first build identified
  an unsupported Testing Library query option in the new test; corrected it
  and repeated the build successfully. npm.cmd run test:browser -- --grep
  "deletion can" passed both desktop and Android-sized checks. Inspected the
  Android pending-state screenshot. git diff --check passed (line-ending notices
  only). Full browser-suite execution was outside this narrow run's scope.
- Existing-user login in browser checks sets the MVP cookie only; record and
  friend mutations were never sent to the DB. No migrations, data imports,
  dependency changes, commits, pushes, or deployments were performed. The
  temporary local production server was stopped after verification.
- Remaining: actual authentication and isolated PostgreSQL concurrency coverage
  are unchanged. Other forms with bespoke pending buttons are not included in
  this shared ActionButtonForm fix.
- Next: inspect pending feedback in anime/profile forms and improve only a
  reproducible layout or accessibility issue; preserve existing local edits.

## 2026-10-09 - Full Layout Goal Completion Audit

- Completed the interrupted layout goal by inspecting current source and the
  rendered home, users, anime list, registration, detail, profile, and friend
  screens. Preserved the earlier behavior improvements and unrelated edits.
- Home requirement: Anime Record is a compact brand heading rather than a large
  explanatory hero. Library and user selection are two prominent icon links,
  at least 88px high on phones and 112px on desktop. The three record/organize/
  analysis-preparation items are compact secondary cards below the actions.
  Current source, measured browser bounds, and inspected screenshots prove the
  intended hierarchy at desktop, 390px, and 320px widths.
- Simple layout requirement: neutral backgrounds, unframed section headers,
  restrained borders, and one teal action accent replace decorative grid and
  hero backgrounds. SS heavy-gold and S lighter-gold rating styles are retained.
- Important-action requirement: list registration, record save/update, profile
  save, user login/creation, and search have larger targets. Added assertions
  that main-page primary commands are at least 56px high and 180px wide, remain
  within the viewport, and do not clip their content. Existing-user login uses
  its intentional 128px desktop minimum and a full-width phone layout.
- Visual inspection found the friend-page back link and eyebrow sharing a line.
  Wrapped the back link in a block so the heading structure matches other pages,
  and added a measured spacing regression check.
- This completion pass changed src/app/users/search/page.tsx,
  tests/browser/read-only.spec.ts, playwright.config.ts, and this log. Added a
  compact Android-sized 320x740 project alongside desktop and 390x844 checks.
- Final verification: all 61 unit/component tests passed in 11 files; lint and
  production build passed. All 24 browser checks passed across the three
  viewport projects. Covered home hierarchy, user-selection focus order, primary
  targets, title suggestions, long-title/genre wrapping, safe deletion feedback,
  rejected invalid input retention, and offline recovery. Inspected desktop and
  phone screenshots, including the corrected friend heading. git diff --check
  passed with informational line-ending notices only.
- No publish, push, merge, migrations, or production data changes were made.
  Browser login only sets the existing MVP cookie; the deletion POST is held
  and aborted in Playwright; whitespace-title validation returns before writes.
  Unit mutation tests use Prisma mocks. Real authentication and isolated DB
  concurrency verification remain independent future work.
- The final production preview is intentionally running at
  http://127.0.0.1:3030 for user review. The layout objective is complete; further
  unattended runs should choose a separate concrete issue rather than repeat
  cosmetic redesigns.

## 2026-10-09 - One-Hour Credential and Friend Workflow Pass

- Continued the improvement backlog and preserved the existing dirty tree,
  simple layout, heavy-gold SS, and lighter-gold S cards. The user selected
  email/password login; implementation and migration preparation remain local.
- Added credential signup/login, scrypt password hashes, 14-day opaque sessions
  stored as digests, secure production cookies, and atomic account-level attempt
  limits. Credential mode ignores numeric-ID cookies and blocks demo actions;
  Vercel cannot enable demo login. New signup never claims existing users/records.
- Added account management and authenticated password changes. Password changes
  revoke prior sessions transactionally; login rechecks the hash under the same
  owner lock. Failed replacement-session creation rolls back both the password
  update and old-session deletion. Logout clears local cookies even during DB
  failure and shows a non-sensitive incomplete-revocation warning.
- Improved credential forms with password visibility controls, pending disabled
  fields, stable button labels, error input retention, and server-side signup
  name/ID length bounds. Signed-in users see account/profile/password links rather
  than signup forms; anonymous visitors cannot query the demo user selector.
- Added confirmed friend removal in search and friend lists. Both friendship
  directions and pair-specific requests are removed under sorted owner locks.
  Other relationships and anime records remain unchanged; repeat removal is safe.
- Added a PostgreSQL auth migration under the configured postgres-migrations
  directory, not the old SQLite history. No real migration/import was executed.
  Tests use mocks and in-memory PGlite, including actual limiter SQL, full auth
  flows, rollback, legacy-owner protection, and friend removal. The narrow test
  query adapter is not the real Prisma/Neon adapter or distributed DB coverage.
- Added npm.cmd run verify: sequential tests, lint, build, and auth browser checks
  with dummy localhost DATABASE_URL/DIRECT_URL values. Prepared manual-only,
  read-permission GitHub verification YAML; it was parsed locally but not pushed,
  enabled, or executed on GitHub. No deployment or database secrets are needed.
- Updated only allowed transitive versions: brace-expansion 1.1.21/5.0.12,
  js-yaml 4.3.2, and source-map-js 1.2.2. npm audit warnings decreased from 15
  (14 high/1 moderate) to 12 (11 high/1 moderate). Remaining framework/Prisma
  dependency warnings are not fixed; no forced downgrade or major upgrade.
- Removed the connection URL from db:init's unsupported-URL error. A subprocess
  test uses a fake PostgreSQL URL, rejects initialization before writes, and
  checks that the password, host, and connection URL are not logged.
- Verification during implementation found and repaired the migration-directory
  mistake, DB/app clock mismatch in attempt expiry, React form-reset loss,
  two TypeScript mismatches, implicit demo-test assumptions, a missing action
  mock, and an alert query colliding with Next's route announcer. One overlapping
  browser-suite invocation exited without diagnostics; the suites passed when
  run independently. Default sandbox cache/SWC permission failures were resolved
  by approved elevated checks; no user data or edits were discarded.
- Final verification: npm.cmd run verify passed all 114 tests in 21 files, lint,
  production build, and 9 credential browser checks. Separately, all 24 legacy
  read-only browser checks passed on the same final build. Browser coverage spans
  desktop, 390px, and 320px; inspected the 320px credential/logout-warning images.
  git diff --check passed (line-ending notices only); workflow YAML safety and
  package-lock root consistency checks passed. Actual GitHub/Linux execution is
  unverified because nothing was published. A default-sandbox localhost health
  request was denied; the approved elevated read returned HTTP 200.
- The final review server is intentionally running on http://127.0.0.1:3030,
  bound to loopback with AUTH_MODE=demo for the unmigrated existing database.
  This is not a preview of active production credential onboarding. The auth
  test server on 3031 was stopped automatically. No commits/pushes/deployments,
  production DB writes, credential provisioning, migrations, or imports occurred.
- Changed scope: prisma/schema.prisma and the additive postgres migration;
  src/lib/auth-{mode,input,session}.ts, password.ts, current-user.ts;
  users auth-actions/credentials forms/page, account actions/form/page,
  users/actions.ts and users/profile/search/page.tsx, home/anime navigation;
  package files, verification script/workflow/configs, init-db guard, README,
  focused auth/friend/form/database/browser tests, and development/rollout logs.
- Remaining before public activation: staging backup/migration verification,
  administrator-confirmed legacy-owner provisioning, email verification and
  forgotten-password recovery, global/IP abuse protection, and expired-row
  maintenance. The public deployment is unchanged and must not be described as
  upgraded. Never assign legacy ownership by an arbitrary public username/ID.
- Next: arrange trusted legacy-owner onboarding and separate staging validation
  with explicit approval; while external setup is pending, improve existing
  friend-notification feedback/accessibility or explainable preference summaries.
  Do not repeatedly redesign colors or apply production migrations unattended.

### 2026-10-09 - Confirmed Legacy-Owner Credential Handover

- Implemented the administrator-only local `users:provision` command. It defaults
  to read-only eligibility checks and requires a dedicated
  LEGACY_SETUP_DATABASE_URL; it never loads .env or falls back to application DB
  URLs. No public claim endpoint or automatic legacy ownership assignment exists.
- Applying requires explicit owner/mailbox verification declarations and an
  interactive terminal. The confirmed owner enters and confirms a hidden
  password. Password arguments/pipes are rejected, and DB errors/URLs/hashes are
  not printed. Manual declarations are not automatic proof of mailbox ownership.
- The transaction locks the exact existing ID/username, refuses existing
  credentials or duplicate normalized email, adds the shared scrypt credential,
  and revokes only that user's old sessions. It does not create or rename users,
  claim orphaned records, or modify records, ratings, tags, featured anime,
  favorite genres, friends, or requests. This is not a password-reset command.
- Verification: all 130 unit/component/database tests passed (22 files), lint
  passed, production build/TypeScript passed, all 9 auth browser tests passed
  across desktop/390px/320px. CLI help succeeded. PGlite tests verify same-ID
  sign-in/data preservation, numeric-cookie rejection, dry-run, duplicate and
  mismatch refusal, no overwrite, rollback on session-revocation failure, and
  CLI secret/piped-input safeguards. Real Neon transport/distributed concurrency
  still require staging validation; no production provisioning was executed.
- Changed files: scripts/legacy-credentials.mjs,
  scripts/provision-legacy-user.mjs, package.json,
  tests/legacy-credentials.test.ts, tests/auth-flow.test.ts, README.md,
  docs/credentials-rollout.md, docs/legacy-user-handover.md, this log.
- No production DB writes/migrations/imports, push, merge, or deployment.
  The local preview remains demo-only for the unmigrated existing database.
- Next: approved staging backup/migration and confirmed-owner acceptance;
  separately implement verified-email invitations and forgotten-password recovery
  before allowing remote unattended onboarding. Global/IP throttling remains a
  public rollout prerequisite. Never provision accounts during an automation run.

### 2026-10-09 - Thirty-Minute Library, Social, and Insight Pass

- Started at 14:30 JST. Preserved the existing dirty worktree and read the local
  Next.js forms, error handling, navigation, and data-security guides.
- Friend mutations retain validated search/page/section context. Return paths
  are canonicalized to /users/search with allowlisted parameters and anchors;
  external/arbitrary paths cannot become redirect targets.
- Incoming requests now have independent 12-item pagination and manual refresh.
  Badge counts use all pending requests, not the current page. Relationship-state
  queries are restricted to users on the visible search page, so a request on a
  different notification page still displays the correct approval controls.
- Friend mutations return generic inline feedback for malformed IDs and DB
  failures. Authentication remains outside the catch, and existing row locks and
  ownership checks are preserved. PGlite verifies rollback after partial friend
  deletion and safe retry without altering records or other relationships.
- Anime lists have 24-record pages and stable update/rating/title ordering.
  Pagination keeps search/rating/status/multiple-genre/AND-OR/sort state. The
  persisted enum order SS/S/A/B/C/D is verified against the real SQL schema.
- Added /anime/insights with owner-only completed-record rating distributions
  and per-genre counts/SS-S percentages. A single aggregate query excludes other
  owners and unwatched/dropped records and does not fetch private reviews/titles.
  This is explainable descriptive statistics, not AI analysis/recommendations.
- Home now shows the owner's pending-request mark; guests trigger no notification
  query. Credential-mode friend request attempts are limited to 10 per owner per
  15 minutes using the existing atomic DB limiter, failing closed if unavailable.
  Local-only demo remains compatible with the unmigrated DB. Global/IP protection
  is still needed; this is not a complete distributed anti-abuse system.
- Visual review found an AND-label wrap after adding sorting and a heading
  alignment issue on insights. Both were fixed and browser assertions added.
- Intermediate checks: 171 tests + lint + build + 9 auth browser tests passed.
  The initial final build found test-only type issues (unknown query row and an
  unsupported Testing Library option); fixed and reverified. The first 27-test
  desktop/390px/320px read-only browser suite passed before those visual fixes.
- Final verification: all 178 tests passed (27 files); lint passed without
  warnings; production build and auth browser suite (9 tests) passed after all
  application edits. After adding the last two boundary tests, the entire test
  suite, lint, and tsc --noEmit passed again. The 27-test read-only browser suite
  passed, and all 6 affected UI checks were rerun successfully after the visual
  fixes on desktop/390px/320px. The new insights page's populated state was also
  inspected visually on desktop and 320px, not only its empty state.
- git diff --check passed (line-ending notices only). Finished around 15:00 JST,
  approximately 30 minutes after starting. The loopback preview is intentionally
  running on http://127.0.0.1:3030 in AUTH_MODE=demo; the auth test server stopped
  automatically. Production is unchanged and not credential-migrated.
- Changed scope: home/anime list/users search and social actions,
  ActionButtonForm, globals.css, auth-session.ts, new anime-insights.ts and page,
  social-return-path.ts and refresh-notifications.tsx; focused unit/DB/component/
  browser tests, README, insights/rollout docs, and this log. No dependency/schema
  changes are needed for this pass. SS/S card palettes are unchanged.
- No production mutations, migrations, imports, credential provisioning, push,
  merge, or deployment. Visual tests only read existing records and set local
  demo cookies; destructive POSTs are intercepted/aborted, never sent to the DB.
- Next: approved staging credential rollout remains separate. Then design
  friend-featured recommendations with explicit matching reasons and unseen-title
  deduplication; avoid inferring strong preferences from very small samples.

### 2026-10-09 - Autocomplete Selection After Result Refresh

- Scheduled pass found a concrete keyboard/accessibility bug: after selecting an
  option with arrows, blurring and refocusing triggers a new search, but the old
  active index survived. A shorter result list referenced a nonexistent option
  through aria-activedescendant and could pass undefined to Enter selection;
  replaced results of the same length silently retained an unintended selection.
- Added two regression cases first and confirmed both fail on the old code.
  Reset activeIndex when fresh results are accepted, and derive a valid active
  suggestion before publishing its ARIA ID or handling Enter. Existing aborted
  request, manual entry, mouse selection, IME confirmation, and scroll behavior
  remain unchanged. No design or ownership/schema changes were made.
- Changed files: src/app/anime/title-autocomplete.tsx,
  tests/title-autocomplete.test.tsx, docs/autonomous-progress.md.
- Verification: 7 focused autocomplete tests passed; npm.cmd run verify passed
  all 180 tests (27 files), lint without warnings, build/TypeScript, and all 9
  credential browser checks. The separate title-scroll/keyboard browser check
  passed on desktop/390px/320px (3 checks). git diff --check passed with existing
  line-ending notices only. DB mutations ran only in the isolated tests; visual
  checks used mocked title responses and existing demo records without saving.
- The repo is outside the current default writable workspace. Git inspection
  and the narrowly scoped apply_patch changes were executed with reviewed
  escalation; no permissions workaround or unrelated files were changed. The
  Windows batch wrapper initially rejected a multiline patch without changing
  files; the native apply_patch entry point applied it successfully.
- The preview was stopped for the build and restored on 127.0.0.1:3030 in
  local-only AUTH_MODE=demo. The isolated auth test server stopped automatically.
  No Neon writes, migrations, imports, provisioning, push, merge, or deploy.
- Unresolved: production credential migration/mail verification/recovery and
  real Neon transport/distributed contention still need approved staging work.
  Next: inspect IME composition/search timing, or the planned explanation-based
  friend-featured recommendations; do not apply production changes unattended.

### 2026-10-13 - IME-Safe Title Search Timing

- Followed the previous pass's IME timing follow-up. The autocomplete searched
  unfinished Japanese composition after its normal 300ms debounce and could
  display an older in-flight response while the user was converting text.
- Added two regression tests first; both failed on the old implementation.
  Track composition state, cancel pending/in-flight searches on composition
  start, clear stale options/selection/loading feedback, and search the committed
  input after composition ends. Composition state also gates keyboard selection.
  Clear composition on blur so an abandoned conversion cannot block later search.
- Changed files: src/app/anime/title-autocomplete.tsx,
  tests/title-autocomplete.test.tsx, docs/autonomous-progress.md. Existing user
  changes, SS/S styling, manual title entry, and the earlier result-refresh fix
  were preserved. No schema, dependency, authentication, or API changes.
- Verification: all 183 tests passed (27 files), including 10 autocomplete cases;
  npm.cmd run verify passed lint without warnings, build/TypeScript, and all 9
  credential browser checks. The existing title-scroll/keyboard browser checks
  passed on desktop/390px/320px (3 checks) after the final build. Two focused
  failures were reproduced before the fix; the third new test covers blur/refocus
  without a composition-end event. git diff --check passed (line endings only).
- IME tests dispatch synthetic React composition events; a physical Android IME
  and vendor-specific event ordering have not been tested. No hardware equivalence
  is claimed. Normal keyboard/scroll behavior was checked in actual browsers.
- The default environment is read-only. Narrow apply_patch edits and verification
  were executed with reviewed escalation, not a permissions workaround. The prior
  preview session was unavailable; no unrelated process was killed. The final
  loopback-only AUTH_MODE=demo preview is running at 127.0.0.1:3030, and the auth
  test server stopped automatically. Production remains unmigrated/unchanged.
- No production Neon mutations, migrations, imports, provisioning, push, merge,
  deployment, paid services, or secret output. Mutation tests used isolated DBs;
  the separate browser checks mocked title responses and did not save records.
- Remaining: real-device IME acceptance, approved staging credential migration,
  verified-email invitations/recovery, and global/IP abuse controls. Next:
  continue owner-safe, explanation-based friend-featured recommendations with
  unseen-title deduplication, or another reproducible workflow bug. Do not repeat
  cosmetic redesigns or apply production changes during automation runs.

### 2026-10-13 - Resilient Title Candidate Data

- Inspected current code after the IME work and found a separate provider-data
  bug: a null candidate made the entire otherwise valid result fail with 502.
  Missing/invalid IDs and duplicate IDs could reach React options, and object or
  malformed year/format values appeared as broken subtitle text.
- Added two regression tests first and confirmed failures before editing the API.
  Skip malformed entries, require positive safe-integer candidate IDs, deduplicate
  selected IDs as well as titles, and trim/type-check optional subtitle fields.
  Valid candidates remain usable when another entry is bad. Existing query bounds,
  timeout, provider-error handling, title fallback order, and no-store fetch remain.
- Changed files: src/app/api/anime-title-suggestions/route.ts,
  tests/title-suggestions-route.test.ts, docs/autonomous-progress.md. No client/UI,
  schema, dependency, ownership, rating-color, or provider-query changes.
- Verification: both new tests failed on the previous implementation; all 16
  focused API/autocomplete tests then passed. npm.cmd run verify passed all 185
  tests (27 files), lint without warnings, production build/TypeScript, and all
  9 credential browser checks. git diff --check passed (existing line-ending
  notices only). Candidate provider calls were mocked, not sent to AniList;
  live provider availability/schema compatibility remains unverified.
- Read-only workspace operations requiring writes were performed with reviewed
  scoped escalation and apply_patch. Earlier preview session was unavailable;
  no unrelated process was stopped. The auth test server stopped automatically.
  A final loopback-only AUTH_MODE=demo preview was started on 127.0.0.1:3030.
- No production Neon writes, migrations, imports, credential provisioning, push,
  merge, deployment, paid service introduction, or secret output. DB mutation
  verification remained isolated. Existing user edits and previous work preserved.
- Remaining: approved staging credential rollout, email verification/recovery,
  physical Android IME acceptance, and global/IP abuse protection. Next: inspect
  another workflow module or implement a small owner-safe recommendation step
  with explicit genre-match reasons and unseen-title deduplication. Do not keep
  redesigning colors or apply production changes unattended.

### 2026-10-15 - Recoverable Profile Save Feedback

- Inspected a different workflow after the title-search fixes. Profile save's
  username lookup ran outside its error handler, and non-unique transaction
  errors were rethrown. Those errors replaced the editing UI rather than returning
  normal form feedback, risking loss of unsaved profile/genre/featured choices.
- Moved only that lookup into the existing try block and return a generic,
  secret-free save-result warning for other failures. The message does not claim
  a failed connection proves that a commit never occurred. Authentication/input
  checks remain before the handler, successful revalidation/redirect remain after
  it, and the existing owner filters, locks, transaction, and duplicate-ID message
  are unchanged. No client UI or color redesign was needed.
- Changed files: src/app/users/actions.ts, tests/user-actions.test.ts,
  tests/profile-form.test.tsx, docs/autonomous-progress.md.
- Regression coverage: lookup and transaction-start rejection return inline
  feedback without DB details or redirects; authentication redirects propagate
  before any profile queries; duplicate-username races keep their specific error;
  successful updates ignore a forged form userId and write only the authenticated
  owner. Component tests preserve edited display name, username, genre and all
  three featured selections after both validation and generic save feedback.
- Verification: 41 focused action/form tests passed. npm.cmd run verify passed
  all 191 tests (27 files), lint without warnings, build/TypeScript, and all 9
  credential browser checks across desktop/390px/320px. The first focused test
  process overlapped patch application, so no pre-fix red run is claimed.
  git diff --check passed with existing line-ending notices only.
- Failure-path tests are mocked; this pass did not newly exercise profile-write
  rollback through a real Prisma/Neon adapter. The existing transaction was kept
  intact. Whole-suite DB mutations remained isolated, with verify replacing DB
  URLs by localhost dummy values. No production profile save was attempted.
- Narrow apply_patch edits and verification used reviewed escalation under the
  read-only default environment. Existing user changes were preserved. The old
  preview session was unavailable; no unrelated process was stopped. A final
  loopback-only AUTH_MODE=demo preview is running on 127.0.0.1:3030; the isolated
  auth test server stopped automatically. No production DB writes, migrations,
  imports, provisioning, push, merge, deployment, paid services, or secret output.
- Remaining: staging credential migration/adapter acceptance, verified email and
  recovery, real Android IME acceptance, and global/IP abuse controls still need
  approved follow-up. Next: another concrete workflow bug or a bounded, owner-safe
  recommendation step with explicit match reasons; do not repeat visual redesigns
  or activate production authentication unattended.

### 2026-10-16 - Explainable Friend-Featured Recommendations

- Completed one bounded recommendation slice on the existing insights page.
  Current friends' featured picks are matched to genres on the signed-in owner's
  completed SS/S records. Each result names its source friend and matching genres;
  no opaque probability or review/AI inference is claimed. Maximum six results.
- A server-side authenticated aggregate query checks current friendship and
  featured status in one snapshot. Non-friends, pending/removed relationships,
  self/orphan/non-featured/blank records are excluded. Only public title/rating,
  friend name/username, and shared genres are returned, never reviews or email.
- Registered titles of every watch status are excluded. NFKC normalization,
  whitespace folding, and lowercase matching also deduplicate different friends'
  picks. Series/translation alias identity is not solved without catalogue IDs.
  Ranking is shared-genre count, friend rating, featured recency (nulls last),
  then record ID. The source link goes to user search, not a private record editor.
- Added six isolated PGlite SQL tests covering boundaries, actual normalization,
  deduplication, reasons, rating/status ownership, ranking/cap, removed/pending
  friends, and no query before authentication. Added populated component coverage
  and extended the existing read-only browser check for the new section/links.
- Changed files: src/lib/friend-recommendations.ts (new),
  src/app/anime/insights/page.tsx, tests/friend-recommendations.test.ts (new),
  tests/anime-insights-page.test.tsx, tests/browser/read-only.spec.ts, README.md,
  docs/anime-insights.md, docs/autonomous-progress.md. Existing card palettes and
  other user changes preserved; no schema/dependency/migration changes.
- Verification: 10 focused recommendation/component tests passed, then all 198
  tests passed (28 files), lint without warnings, and production build/TypeScript
  passed. The first verify run stopped at the auth browser server's 60-second
  startup timeout; a standalone retry with the same build and explicit dummy DB
  URLs passed all 9 auth checks. No application edits were needed for that retry.
  All 3 read-only insights/refresh browser checks passed on desktop/390px/320px.
  Inspected the 320px screenshot: empty recommendation state fits; populated
  recommendation content is covered by component tests and DB fixtures, not
  claimed as visually verified with real populated user data. diff --check passed.
- SQL mutation tests used only in-memory PGlite. Browser tests only read configured
  existing demo data; no records/friendships/profiles were saved. Real adapter
  reads ran through the preview, but production writes, migrations, credential
  provisioning, imports, push, merge, deployment, and paid services were not used.
  Reviewed scoped escalation was used under the read-only default environment.
- The old preview session was unavailable and no unrelated process was stopped.
  Latest loopback AUTH_MODE=demo preview is running at 127.0.0.1:3030. The isolated
  auth test server stopped automatically. Production remains unchanged.
- Remaining: small samples and title aliases limit recommendation quality; no
  external catalogue or AI review analysis is implemented. Approved credential
  staging rollout, verified email/recovery, Android real-device acceptance, and
  global/IP protections are still separate requirements. Next: review actual
  recommendation feedback or a concrete workflow bug; do not apply production
  changes or keep making speculative cosmetic edits during scheduled runs.

### 2026-10-17 - Personal Drafts From Recommendations

- Completed one bounded workflow improvement: a recommendation's Record button
  opens the signed-in user's registration form with only its title prefilled.
  The friend's rating, review, watch status, and owner are never copied. Opening
  the link does not save anything; the existing authenticated save action remains
  unchanged. Draft keys include owner and title to reset stale unsaved form state.
- Added a fixed local URL builder and bounded query parser: first title only,
  trimmed, maximum 200 UTF-16 units, no internal control characters. Invalid or
  oversized prefills fall back to a blank draft rather than a truncated title.
  Reserved URL characters remain title data. Manual save validation is unchanged.
- Changed files: src/lib/anime-registration.ts (new),
  src/app/anime/new/page.tsx, src/app/anime/insights/page.tsx,
  tests/anime-registration.test.ts (new), tests/anime-new-page.test.tsx (new),
  tests/anime-insights-page.test.tsx, tests/browser/read-only.spec.ts,
  tests/browser/credentials.spec.ts, README.md, docs/anime-insights.md, and this
  log. Existing user edits and SS/S palettes preserved; no schema/dependency edits.
- Verification: all 213 tests passed across 30 files, lint without warnings,
  production build/TypeScript passed, and all 9 isolated credential browser tests
  passed. Six targeted read-only browser checks passed across desktop/390px/320px,
  including literal title prefill, unchanged defaults, ignored owner/rating query,
  no POST after login, and no horizontal overflow. Inspected the 320px draft
  screenshot: fields and save control fit; long input text scrolls within its
  field. Populated recommendation links are covered by component/SQL tests;
  real populated recommendation cards were not claimed as visually verified.
- One verification invocation did not start because its permission review timed
  out; the explicitly permitted single retry completed successfully. Scoped
  reviewed escalation was used under the read-only default environment. Database
  mutation tests remained isolated in PGlite/mocks; browser checks only read
  existing data and used the local demo login cookie. No record was submitted,
  and no production writes, migrations, provisioning, imports, push, merge,
  deployment, or paid services were used. Preview: http://127.0.0.1:3030.
- Remaining: recommendation title aliases and small samples; approved credential
  staging rollout, verified email/recovery, physical Android/IME acceptance, and
  global/IP protections remain separate work. Next: inspect real recommendation
  feedback or another reproducible workflow issue before adding new behavior.

### 2026-10-18 - Reset Profile Drafts Across Owners

- Found a concrete state-isolation bug: if an authenticated owner changed while
  React reconciled the same profile route, ProfileForm kept the previous owner's
  unsaved name, username, genre choices, and featured IDs. The existing action
  still enforced current-owner ownership, but stale personal input could be
  displayed or submitted as the new owner's profile values.
- Added an authenticated owner ID key to ProfileForm at its server-page boundary.
  An owner switch now remounts all draft/action state from the new owner's data.
  Same-owner server refreshes deliberately preserve unsaved input. No save or
  authentication action, database schema, or SS/S styling was changed.
- Added three page-level regression tests using the actual client form and
  mocked authentication/database/actions: owner switch resets private drafts,
  genre and featured choices; same-owner refresh retains edits; failed
  authentication prevents all profile queries. None submits a profile.
- Reproduced the bug before fixing it: the owner-switch test failed with
  Private draft instead of Owner 2; the two other tests passed. After the fix,
  npm.cmd run verify passed all 216 tests across 31 files, lint without warnings,
  production build/TypeScript, and all 9 isolated credential browser checks on
  desktop/390px/320px. No new layout was introduced; owner switching is verified
  with component rerenders, not claimed as a live multi-account browser test.
- Changed files for this slice: src/app/users/profile/page.tsx (one key),
  tests/profile-page.test.tsx (new), docs/autonomous-progress.md. Read the bundled
  Next page guide and credential rollout notes before editing. Existing dirty
  worktree edits were preserved. Reviewed scoped escalation was required under
  the read-only default sandbox; verification overrides DB URLs with dummy local
  values. No production data reads/writes, migrations, credential provisioning,
  import, push, merge, deployment, or paid services were performed this run.
- Remaining: approved credential staging rollout, verified email/recovery,
  physical Android/IME acceptance, and global/IP abuse protection are still
  outstanding. Next: inspect another concrete state/ownership workflow issue;
  do not deploy the prepared authentication changes against an unmigrated DB.

### 2026-10-19 - Consistent Profile Length Validation

- Found an input-validation inconsistency: credential signup rejected display
  names over 100 UTF-16 units and usernames over 64, but the shared basics parser
  used by profile updates and local demo registration accepted arbitrary lengths.
  Updating a profile therefore bypassed the existing signup limits.
- Enforced the same bounds in parseUserBasics after trimming/normalization and
  added matching maxLength attributes to profile and local registration inputs.
  Oversized submissions receive recoverable Japanese feedback before profile DB
  lookup/transaction work. Values are rejected, never silently truncated. Existing
  data is not rewritten; an already oversized legacy profile must be shortened
  explicitly when next saved. Signup's existing defensive checks are preserved.
- Added six regression tests: two over-limit parser cases, exact limits with
  trimming/lowercasing, two action-level no-query/no-write checks, and profile
  input limit attributes. Before the fix, four tests failed as expected, proving
  the parser accepted oversized values and updates reached the DB lookup.
- Verification: npm.cmd run verify passed all 222 tests across 31 files, lint
  without warnings, production build/TypeScript, and all 9 isolated credential
  browser tests on desktop/390px/320px. git diff --check passed (existing Windows
  line-ending warnings only). No layout or SS/S color changes were introduced.
- Changed files: src/lib/user-form-data.ts,
  src/app/users/profile/profile-form.tsx,
  src/app/users/user-registration-form.tsx, tests/form-data.test.ts,
  tests/user-actions.test.ts, tests/profile-form.test.tsx, and this log.
  Read the bundled Next forms guide before editing; existing dirty changes were
  preserved. Tests use mocks/in-memory databases and verify forces dummy DB URLs.
  Scoped reviewed escalation was used under the read-only default sandbox. No
  production data access/writes, migrations, provisioning, imports, push, merge,
  deployment, or paid services were performed. The auth test server stopped.
- Remaining: legacy oversized profiles require explicit user correction, not
  unattended data repair. Credential staging rollout, email verification and
  recovery, physical Android acceptance, and global/IP throttling remain separate
  requirements. Next: inspect another reproducible validation or workflow issue.

### 2026-10-19 - Clear Password Drafts After Successful Changes

- Found that the password-change page reused an unkeyed controlled form after
  redirecting back to the same route. Its current/new/confirmation password inputs
  could retain old values after success or an authenticated owner change.
- Successful password changes now redirect with a fresh public UUID completion
  marker. The form key combines authenticated owner and valid completion marker,
  so every successful change, including consecutive changes, remounts empty
  fields. Same-marker refreshes and rejected submissions retain their drafts.
  Legacy changed=1 links still show the status; malformed markers are ignored.
- The marker is presentation state, not proof of a password change or identity.
  It is independently generated and contains no password, email, session token,
  or session digest. Authentication, transaction locks, hash verification, session
  revocation, and cookie handling are unchanged. This clears form state, not a
  promise of cryptographic memory erasure or password-manager storage removal.
- Added four real-form page tests and one action test for consecutive non-secret
  completion URLs. Two page tests failed before the fix, reproducing retained
  password fields. The first full verification then exposed a stale fixed-URL
  expectation in the isolated auth integration test; updated only that assertion,
  preserving session rotation and old-password rejection checks.
- Final npm.cmd run verify passed all 227 tests across 32 files, lint without
  warnings, production build/TypeScript, and all 9 credential browser checks on
  desktop/390px/320px. Form clearing is covered by page rerenders and isolated
  actions/SQL integration, not claimed as a live production password-change test.
- Changed files: src/app/users/account/actions.ts,
  src/app/users/account/page.tsx, tests/account-page.test.tsx (new),
  tests/password-change.test.ts, tests/auth-flow.test.ts, and this log. Read the
  bundled Next page/forms guides and credential rollout notes before changes.
  Existing edits and SS/S colors preserved; no schema or dependency changes.
- Verification used mocks/in-memory databases and forced dummy connection URLs.
  No production data access or writes, migrations, provisioning, imports, push,
  merge, deployment, or paid services. Scoped reviewed escalation was used under
  the read-only default environment. The isolated auth browser server stopped.
- Remaining: staged credential rollout, verified email/recovery, physical Android
  and password-manager acceptance, and global/IP throttling remain separate work.
  Next: inspect a concrete existing workflow issue; do not migrate production or
  expand authentication features without the required external setup/approval.

### 2026-10-20 - Announce Available Title Candidates

- Found an accessibility gap in title search: the existing polite live status
  announced loading, errors, and no matches, but became empty on success. Users
  relying on that status received no result-availability/count notification.
- Successful searches now put the candidate count in the same status region.
  No automatic selection or focus change was added. Existing selection dismissal,
  IME handling, cancellation, manual entry, empty-result/error feedback, and
  keyboard navigation remain unchanged. No API/schema/style changes.
- Added two component tests with mock fetch: loading becomes a successful count
  without selecting a candidate and clears on selection; an empty result keeps
  its dedicated message and no listbox. The successful-count test failed before
  the fix because status text was empty; the other 11 focused tests passed.
- Verification: npm.cmd run verify passed all 229 tests across 32 files, lint
  without warnings, production build/TypeScript, and all 9 credential browser
  checks across desktop/390px/320px. The live-region content/attributes are tested
  in the component environment; actual Android TalkBack speech was not tested.
- Changed files: src/app/anime/title-autocomplete.tsx,
  tests/title-autocomplete.test.tsx, docs/autonomous-progress.md. Read bundled
  Next accessibility guidance before implementation; preserved existing worktree
  edits and SS/S colors. Tests used mocks/in-memory databases, with verify forcing
  dummy DB URLs. Scoped reviewed escalation was required by the read-only default.
  No production data access/writes, migration, provisioning, import, push, merge,
  deployment, external API requests, or paid services. Auth test server stopped.
- Remaining: Android TalkBack/IME real-device acceptance, staged credential
  rollout, email verification/recovery, and global/IP throttling. Next: prioritize
  actual workflow feedback or another reproducible issue over speculative changes.

### 2026-10-20 - Personal Tier Journal (User-Requested Product Change)

- The scheduled audit was superseded by explicit user requests: switch from a
  social/account app to a personal journal, grade SS/S/A/B/C/D/E, require title and
  watched year/month with optional comment, review yearly/monthly tier boards,
  and persist meaningful left-to-right ranking. The final follow-up requested
  smaller cards showing only the title. These requirements replace social work.
- Implemented a browser-local library at / and /library with no login or DB
  query. Legacy /anime and /users URLs redirect to /library. Server/auth code and
  old data remain intact as legacy reference, not publicly linked workflows.
  Nothing was deleted from or automatically migrated out of Neon. The old local
  schema used SS through D; E belongs to the new independent local data model.
  No numeric-score-to-grade conversion was invented.
- New entries collect metadata, then enter an unsaved evaluation tray. Dropping
  onto a grade saves the record. dnd-kit supports mouse/touch/keyboard sensors;
  moving before/after another work persists array order, and metadata edits do
  not move the work to the end. Year/month filtering preserves relative order.
  Title/comment/genre search, AND/OR genre filtering, watch status, list view,
  date/title/grade sorting, editing and confirmed deletion remain available.
- Tier cards now show ONLY title, at 140px width and 56px button height (58px
  including border). No date, grade selector, arrows, or grip icon remain inside
  cards. The whole card is draggable; long titles use two lines and a full-title
  tooltip. Horizontal row scrolling preserves the left/right interpretation on
  mobile. SS heavy gold and S lighter gold were retained. Genres are collapsed
  in the editor to keep the primary metadata workflow compact.
- Local storage writes are explicit (never on hydration), validated, and reject
  stale-tab snapshots or quota failures without reporting success. Corrupt data
  blocks editing rather than overwriting it. JSON export/import is versioned;
  import validates up to 10 MB/10000 records, confirms full replacement, and does
  not import unknown fields. Missing watched months stay unknown, not guessed.
  Records are per origin/browser; no cloud sync or full offline shell was added.
  Title suggestions still send the typed search to AniList; comments are local.
- Changed/new implementation files: src/app/personal-library.tsx,
  src/app/tier-board.tsx, src/lib/personal-library.ts, src/app/page.tsx,
  src/app/library/page.tsx, src/app/globals.css, src/app/manifest.ts,
  next.config.ts, package.json and package-lock.json (dnd-kit only).
  Verification/docs: tests/personal-library.test.ts, tests/tier-board.test.tsx,
  tests/home-notifications.test.tsx, tests/browser/personal.spec.ts,
  playwright.personal.config.ts, playwright.config.ts, scripts/verify.mjs,
  README.md, docs/autonomous-development.md, and this log. The recurring prompt
  was updated to personal tier-journal priorities, not account/friend features.
- Verification: final npm.cmd run verify passed all 253 tests (34 files), lint,
  production build/TypeScript, and 9 personal-browser checks across desktop,
  390px, and 320px. These cover create/drag grade/edit/delete/reload/backup restore,
  untouched corrupt storage, actual insertion of ka between e and o, retained
  order after metadata edits/reload, yearly views, title-only card dimensions,
  and no record POST. Inspected desktop and 320px screenshots: compact gold cards,
  SS labels unwrapped, no input icon overlap or document horizontal overflow.
  Initial runs caught old label selectors, a test-only type mismatch, modal
  scrolling, and drag-edge/click-suppression timing; corrected before final pass.
- All write tests used mocks/PGlite or isolated browser storage. No production
  DB access, migration, import, credential provisioning, push, merge, or deploy.
  Reviewed scoped escalation was used in the read-only environment. Preview runs
  at http://127.0.0.1:3032 with dummy DB URLs. The isolated test server stopped.
- npm audit --omit=dev reports 7 existing Prisma-toolchain advisories (6 high,
  1 moderate); dnd-kit was not reported. No breaking auto-fix was applied. Review
  or remove the legacy Prisma build toolchain separately before public rollout.
  Remaining: real Android touch/TalkBack and keyboard-flow acceptance, complete
  offline app shell, explicit owner-approved legacy-data export/import if wanted,
  and browser storage/backup recovery ergonomics. Do not reintroduce auth/social
  features or migrate old production data during scheduled improvements.

### 2026-10-20 - Small Watched-Month Labels

- User requested a small watched date at the top-left of tier cards. Added
  YYYY/MM with a semantic time element and a non-fabricated unregistered fallback.
  Kept 140px width/56px content height, two-line titles, SS/S colors, and whole-card
  dragging. The date overlay ignores pointer events and never overlaps the title.
- Changed src/app/tier-board.tsx, src/app/globals.css, tests/tier-board.test.tsx,
  tests/browser/personal.spec.ts, README.md, docs/autonomous-development.md,
  and this log. No stored data, dependencies, or backend behavior changed.
- Verification: 254 unit tests, lint, build/TypeScript passed. All 9 browser
  checks passed on retry, including top-left label geometry, unchanged card size,
  title/date non-overlap, drag insertion and persistence at desktop/390px/320px.
  Inspected desktop and 320px screenshots. Initial sandbox execution failed on
  temporary-cache rename permissions; scoped reviewed execution passed. One
  browser run had ERR_NETWORK_IO_SUSPENDED before page load; an unchanged-build
  retry passed. No application code changes were needed for either environment
  failure. Preview restarted at http://127.0.0.1:3032 with dummy DB URLs.
- No production DB access or writes, migration, push, or deployment. Remaining
  product limitations and Prisma audit warnings are unchanged from the prior log.
