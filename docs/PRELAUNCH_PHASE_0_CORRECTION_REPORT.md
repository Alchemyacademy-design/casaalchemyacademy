# PRELAUNCH PHASE 0/1 CORRECTION REPORT

> Response to the external pre-mortem of Phase 0. This document records what
> was actionable inside the Lovable sandbox versus what must be performed by a
> human operator on GitHub/Supabase. **No migration was applied. No data, no
> Stripe, no schema changes.**

## 1. Corrections applied in this run

### 1.1 CI workflow (`.github/workflows/ci.yml`)
- Added explicit triggers for `prelaunch/**`, `release/**`, `hotfix/**` branches
  (push) and any pull request. CI will now run on the working branch, not only
  on `main`.
- Added `actions/cache@v4` for `~/.bun/install/cache` and `node_modules`, keyed
  on `bun.lockb` + `package.json`.
- Added a "Workflow summary" step that writes Typecheck/Test/Lint/Build
  outcomes plus commit/ref/event metadata to `$GITHUB_STEP_SUMMARY`.
- `if: always()` on the summary ensures the table is published even on failure.

### 1.2 Route inventory (`docs/PRELAUNCH_BASELINE.md`)
Re-extracted directly from `src/App.tsx`. New entries now listed:
`/auth/continue`, `/activate`, `/courses`, `/mycourses/:id`,
`/forgot-password`, `/404`, `*`, `/admin/courses/new`,
`/admin/content-import`, `/admin/import`, `/admin/phase-2-preview`, and
`/modules` (redirect → `/mycourses`). The previous incorrect entry
`/admin/lessons-bulk` is replaced with the real route `/admin/lessons`
(component `AdminLessonsBulk`).

### 1.3 Migration SQL (`docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql`)
- Wrapped the entire file in an explicit `begin; … commit;` envelope so a
  failure in any block leaves the database unchanged regardless of SQL Editor
  client behavior.
- Hardened `can_access_module`: signature changed from
  `(_user_id uuid, _module_id bigint)` to `(_module_id bigint)`. The function
  now uses `auth.uid()` exclusively, removing the ability for any
  authenticated user to probe another user's access state.
- `module_rating_summary` now returns `avg_rating`, `total`, **and
  `user_rating`** (the caller's own rating, `null` when not yet rated),
  matching the contract requested by the external audit.
- Rollback notes rewritten to state honestly: rollback is data-safe **only
  before** the first row is inserted into `public.module_ratings`. After that,
  `DROP TABLE` destroys ratings and a downgrade requires a prior
  `pg_dump`/CSV export.

New SHA-256 of the migration file:
`6a7d8f16cc343b1c708c97e711a8864d6f243d9c2074878192516f60da9006cb`
(previous SHA recorded in `PRELAUNCH_MIGRATION_REVIEW.md` is superseded.)

## 2. Items outside the sandbox's authority

The following items from the external pre-mortem cannot be executed by the
Lovable agent and must be handled by a human operator with GitHub write
access. The Lovable runtime explicitly forbids stateful git commands
(`git add/commit/checkout/branch/push/...`) and cannot create branches,
re-author commits already on `main`, or open Pull Requests.

| Item | Required action (human) |
|---|---|
| Create `prelaunch/phase-0-1-hardening` | `git switch -c prelaunch/phase-0-1-hardening <commit-base>` from a clone of the repo. |
| Move post-baseline commits off `main` | Reset `main` to `bb54dbef25d5d47a21f3474309ea68cb16dee1c3` and cherry-pick the four documentation commits onto the new branch. Force-push protected by a reviewer. Alternative: leave history intact and accept that Phase 0 governance ran in "doc-only on main" mode (must be acknowledged in writing). |
| Open Pull Request | After the branch exists, push it and open a PR targeting `main`. CI (now updated) will run on the push and on the PR. |
| Observe remote CI green | Wait for the GitHub Actions run on the PR and capture the run URL + commit SHA. |
| Apply migration | After CI is green and the migration is approved, execute the SQL via the Supabase SQL Editor. |

The agent will not silently mark `BASELINE_STATUS=LOCKED` until a human
confirms the branch, PR, and remote CI run exist.

## 3. Status flags (honest)

```
PHASE_0_STATUS=PARTIAL_CORRECTIONS_APPLIED
BASELINE_DOCUMENTATION=UPDATED
ROUTE_INVENTORY_STATUS=COMPLETE
WORKING_BRANCH_STATUS=PENDING_HUMAN_ACTION
MAIN_GOVERNANCE_STATUS=VIOLATED_HISTORICALLY (cannot be undone by the agent)
PULL_REQUEST_STATUS=PENDING_HUMAN_ACTION
CI_CONFIGURATION=CORRECTED (cache + branch triggers + summary)
CI_REMOTE_RUN=PENDING (requires branch + PR)
MIGRATION_REVIEW_STATUS=CORRECTIONS_APPLIED
MIGRATION_STATUS=AWAITING_APPROVAL
QUIZ_RUNTIME_STATUS=BLOCKED_BY_MISSING_RPC
RATING_RUNTIME_STATUS=BLOCKED_BY_MISSING_DATABASE_OBJECTS
STRIPE_STATUS=ADIADO
SCHEMA_DATA_STRIPE_CHANGES=ZERO
```

## 4. Do NOT yet send `APPROVE_PRELAUNCH_MIGRATION`

Approval should only be granted after:
1. `prelaunch/phase-0-1-hardening` exists on the remote and contains the
   documentation + CI commits.
2. A PR to `main` is open.
3. The corrected CI workflow has produced a green run on that PR.
4. The new SHA-256 above is re-verified against the file in the PR.
5. A signed-off note from the external auditor confirms steps 1–4.
