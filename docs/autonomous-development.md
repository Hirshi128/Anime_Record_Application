# Autonomous Development

## Current Product - 2026-10-20

The app is now a personal browser-local anime journal without login, passwords,
or friend sharing. Ratings are SS/S/A/B/C/D/E. The active UI is / and /library;
legacy /users and /anime paths redirect to /library. Do not restore account or
friend features during scheduled work. Priorities are safe local persistence,
JSON backup/restore, Android/accessibility, search/filtering, and personal insights.
Use npm.cmd run verify: it runs all unit tests, lint, build, and the new personal
browser suite. Old auth/server modules and tests are retained only as legacy
reference. All production Neon data must remain untouched. The auth rollout and
social priorities below are historical, not instructions to deploy or extend them.
Personal-app builds require no database URL. Keep legacy Prisma initialization
lazy: imports may occur during Next page collection, but only actual DB use should
require configuration. verify deliberately builds with both DB URLs empty; do not
replace this regression check with dummy URLs that hide eager initialization.
Local records are per browser and origin, not cloud-synced. The personal shell and
immutable static assets now support offline restarts after an online warm-up on
HTTPS/localhost. Never cache API, RSC, legacy/auth pages or hydrated user content.

Latest user preference: remove the home subtitle, label the primary add command
as 視聴したアニメを追加, and remove file export/import UI. Normal saves still
persist across reloads/restarts without any manual file operation. Do not restore
those file controls unless requested. Browser data deletion loses records and no
cross-device transfer/sync is provided; preserve the visible storage warning.
The backup/restore priorities elsewhere in this document are historical.

The user's detailed workflow is title + watched year/month + optional comment,
then grade by placing the draft into a seven-grade tier board. Within each grade,
left-to-right order is meaningful and persisted in the backup record array. Year
and month filters must preserve that relative order, as must metadata edits.
Records written by the current code use version 2 in the existing storage key.
Read version 1 without auto-writing; old clients must reject v2 instead of dropping
rewatch history. Rewatch snapshots retain dates, grades, comments and tags, with a
200-entry limit per work. Historical period projections are read-only; only latest
records may be reordered. Tie-breaking in summaries uses the current tier order,
not a stored historical board position. Preserve the stale-tab write safeguards.
Never fabricate missing watched dates for legacy records. Use dnd-kit for touch,
mouse, and keyboard dragging. Tier cards must stay compact (140px wide, 56px
content height). Display the watched month in small text at the top-left and the
title below it. Unknown dates must say they are unregistered. Do not restore grade
selects or arrow toolbars inside each card. A separate tap-open placement dialog
provides those accessible alternatives. Other details stay in the list/editor.
Keep custom rating guides, yearly/monthly insights, duplicate-title warnings,
image-only tier export and the save-state indicator. Do not mistake PNG saving
for a data backup or restore manual JSON file controls. Delete undo must refuse
to overwrite newer changes and form cancellation must protect dirty edits.

## Purpose

Improve this anime recording and recommendation community through a recurring
Codex task attached to the existing chat. The scheduler configuration lives in
Codex, not in Git. This document and the progress log travel with the repository.

## Cadence

Run every six hours while the local computer and Codex app are available.
Complete one bounded improvement per run, including verification. Resume an
unfinished improvement before starting another one.

## Workflow

1. Read AGENTS.md, this document, and docs/autonomous-progress.md.
2. Inspect Git status and diffs. Preserve user edits and previous automated work.
   If an overlapping user edit prevents progress, choose an independent task.
3. Inspect the current implementation and select the most useful concrete issue.
   Read the relevant bundled Next.js guide before writing Next.js code.
4. Implement a small, reviewable change that fits the existing application.
5. Verify with focused checks, npm.cmd run lint, and npm.cmd run build when code
   changes warrant a build. Add meaningful tests for behavior with real risk.
   Use an isolated test database for write tests; the configured Neon database
   may contain production data.
6. Inspect the final diff. Record changes, verification, unresolved problems,
   and the next action in docs/autonomous-progress.md.
7. Report completed improvements, failures, or necessary user decisions in the
   existing chat. Stay quiet when nothing meaningful has changed.

## Priorities

- Fix reproducible bugs and regressions in existing workflows first.
- Strengthen user identity, sessions, and record ownership. The existing
  anime_record_user_id cookie alone is not proof of identity. Prepare changes
  locally; preserve existing users and records when designing an upgrade.
- Improve Android layouts, accessibility, form feedback, and loading/error states.
- Improve friend requests, notifications, and sharing of featured anime.
- Build explainable preference summaries and recommendations from existing
  ratings and genres after the user and friend workflows are reliable.

Choose from evidence in the code and previous progress, not from this list alone.
Avoid repeatedly changing colors or adding speculative features without a
concrete benefit. Preserve the requested heavy-gold SS and lighter-gold S design.

## Current Authentication Rollout

Email/password authentication is prepared locally. Read
docs/credentials-rollout.md before changing identity or publishing code. The
production DB is not migrated: never assume local preparation means deployed
authentication. Do not provision legacy owners or apply migrations unattended.
Use npm.cmd run verify for isolated checks; it substitutes dummy DB URLs and
starts/stops its own credential UI test server on 3031. The separate demo browser
suite on 3030 requires AUTH_MODE=demo and a loopback-only server. The GitHub
verification workflow is manual-only, unpublished, and does not deploy.

## Execution Boundaries

- Work in C:/Users/hirsh/Documents/anime_record.
- Keep changes local and reviewable. Do not push, merge, deploy, or publish.
- Do not reset, discard, or overwrite changes made by the user.
- Do not write to production databases, run migrations against Neon, or import
  data during unattended runs. Prepare migration files and instructions locally.
- Do not expose environment values, credentials, or personal database contents.
- Do not introduce paid services or change provider/account settings.
- Avoid major dependency upgrades and framework replacements.
- If an external choice or credential is essential, describe the exact need and
  continue independent work. Do not repeatedly report the same unresolved blocker.
- Respect the sandbox and usage limits. Scheduling does not bypass approvals.

## Operation

The task needs the computer powered on, awake, and the Codex app running.
Review or pause it in the app's scheduled-task controls. This is periodic work,
not a continuous server, and it does not update the Vercel site automatically.
