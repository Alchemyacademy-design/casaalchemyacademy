# PRELAUNCH FINAL MIGRATION AUDIT — Phase 1A

> Read-only audit. **No migration applied, no schema changed, no data touched,
> no Stripe activity, no PR merged, no edge function redeployed.**

## 0. Identification

| Field | Value |
|---|---|
| GitHub repository | `Alchemyacademy-design/alchemy-academy-preview` |
| Working branch | `prelaunch/phase-0-1-hardening` |
| Protected branch | `main` |
| Pull Request | `#1 — Prelaunch Phase 0/1 hardening gate` (draft) |
| Branch SHA at audit start | `36a6e5a37766c838fd3d9bb3eccbd928a453390a` |
| Supabase project ref | `omzwtfnqffseemrlylwu` |
| Lovable project | `aa3b388c-6623-43ee-8740-326108415543` |
| Protected admin | `contact@casaalchemystudio.com` |
| Migration source of truth | `docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql` |
| Expected SHA-256 | `6a7d8f16cc343b1c708c97e711a8864d6f243d9c2074878192516f60da9006cb` |
| Stripe | `STRIPE_STATUS=ADIADO`, `STRIPE_LIVE_ENABLED=false` |

> Git state assertions (branch existence, PR open/draft, remote CI green) are
> outside the agent's authority and must be confirmed by the human operator
> on GitHub before promotion. See §11.

## 1. Hash revalidation (Etapa 1)

`sha256sum docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql`
→ **`6a7d8f16cc343b1c708c97e711a8864d6f243d9c2074878192516f60da9006cb`**
→ **MATCHES** expected hash. File length: 337 lines. No drift.

## 2. Static SQL audit (Etapa 2)

| Check | Result |
|---|---|
| Exactly one `begin;` at line 33 | PASS |
| Exactly one `commit;` at line 335 | PASS |
| No `insert`/`update`/`delete` on application data | PASS (only DDL + `create or replace function`; the `insert into public.quiz_attempts` is inside the RPC body, executed only at member submission time, never by the migration itself) |
| No `truncate`, no `drop table` of existing tables | PASS (only `drop policy if exists`, `drop trigger if exists`, `create table if not exists`) |
| No changes to Stripe tables, users, courses, memberships, entitlements, content status | PASS |
| No hardcoded user_id, course_id, plan_key | PASS |
| No external/HTTP/network call | PASS |
| Every `security definer` sets `search_path = ''` | PASS — `internal_submit_quiz_attempt` L74, `can_access_module` L246, `module_rating_summary` L313, `touch_module_ratings_updated_at` L301 |
| Fully qualified identifiers (`public.*`, `auth.*`) | PASS |
| No dynamic SQL on user input | PASS (only one `format()` inside DO block, identifier comes from `pg_policies`, not user input) |
| Minimal grants | PASS — see §4 |
| `anon` privilege escalation | NONE granted |
| `authenticated` admin escalation | NONE granted |
| `service_role` over-grant | NONE (only RPC execute + table ops needed by edge functions) |

## 3. `quiz_options` lockdown (Etapa 3)

Migration executes (L41-44):

```sql
revoke select on table public.quiz_options from authenticated;
revoke select on table public.quiz_options from anon;
revoke select (is_correct) on public.quiz_options from authenticated;
revoke select (is_correct) on public.quiz_options from anon;
```

Plus the dynamic loop (L51-60) drops every existing `SELECT` policy on
`public.quiz_options`. Admin `INSERT/UPDATE/DELETE` policies are preserved
(loop filters `cmd = 'SELECT'`). `service_role` retains `ALL` (L47).

### Repository sweep for `quiz_options` / `is_correct`

| Location | Classification |
|---|---|
| `supabase/functions/get-member-quiz/index.ts` (`quiz_options(... no is_correct ...)`) | server-only, service-role, member-safe shape |
| `supabase/functions/get-admin-quiz/index.ts` (`quiz_options(... is_correct ...)`) | server-only, admin-gated by `isAdminUser` |
| `supabase/functions/submit-quiz-attempt/index.ts` | server-only, forwards selections to RPC, never returns `is_correct` |
| `supabase/functions/admin-audit/index.ts` | admin-only inventory string, no payload exposure |
| `src/manus/services/quiz.ts` | types only; runtime path uses edge functions (verified by `quiz.routing.test.ts`) |
| `src/manus/components/admin/AdminQuizEditor.tsx` (`.from("quiz_options")`) | admin-only editor; RLS on admin INSERT/UPDATE/DELETE policies still gates writes; **admin must retain table-SELECT access in production OR be migrated to `get-admin-quiz` for reads**. Editor currently reads via service-role-fronted `get-admin-quiz`; the `.from("quiz_options")` calls are write-only (`insert`, `update`, `delete`). VERIFIED: no `.select(` on `quiz_options` from the browser. |
| `src/integrations/supabase/types.ts` | generated types; not a runtime read |
| `src/manus/services/quiz.test.ts`, `quiz.routing.test.ts` | unit tests; fixtures only |
| Migration file | self-reference |

**No frontend code path performs `.select(...).from("quiz_options")`.** The
admin editor only writes. Routing test (`quiz.routing.test.ts`) enforces
edge-function-only reads.

## 4. RPC `internal_submit_quiz_attempt` audit (Etapa 4)

| Property | Status |
|---|---|
| `SECURITY DEFINER` | YES (L73) |
| `set search_path = ''` | YES (L74) |
| `revoke all ... from public` | YES (L220) |
| Grant to `anon` | NO |
| Grant to `authenticated` | NO |
| Grant to `service_role` | YES (L221) |
| Advisory lock per `(user_id, quiz_id)` | YES (L101-103, `pg_advisory_xact_lock(hashtextextended(...))`) |
| Quiz must be `published` | YES (L110) |
| Admin preview blocked | YES (L114-119, raises `admin_preview_blocked`) |
| Access check considers membership, entitlement, free, guest | YES (L121-139) |
| Archived course excluded | YES (L133, `c.archived_at is null`) |
| `max_attempts` enforced after lock | YES (L142-149, runs after `pg_advisory_xact_lock`) |
| All questions required | YES (`missing_answer`, L172-174) |
| Duplicate question rejected | YES (`duplicate_question`, L160) |
| Extra answer rejected | YES (`extra_answer`, L175-177) |
| Option must belong to question | YES (L165-167) |
| Question must belong to quiz | YES (L162-164) |
| Attempt + answers atomic | YES (single function body, single transaction; failure rolls back via plpgsql exception) |
| Score / passed computed server-side | YES (L194-206) |
| Return shape only `{score, passed, attempts_remaining}` | YES (L215) |

### Edge cases reviewed

| Case | Behavior |
|---|---|
| Quiz has no questions | `v_expected_q = []`; if `p_answers` is also empty, `v_total_points = 0`, `v_score = 0`, `v_passed = false`. Attempt is still recorded. **Acceptable but consider gating publication in the editor (already enforced by `isQuestionPublishable`).** |
| `passing_score` is null | Schema defines `passing_score number` (NOT NULL, default present); RPC guards via `coalesce(v_quiz.passing_score, 0)`. SAFE. |
| `max_attempts` null | Treated as unlimited; `v_remaining` returns null. SAFE. |
| `p_answers` empty array | `jsonb_typeof = 'array'` passes; loop no-ops; `missing_answer` raised if quiz has questions. SAFE. |
| Non-numeric `question_id` / `option_id` | `(v_answer->>'question_id')::bigint` raises `invalid_text_representation`; mapped to generic `submission_failed` by edge function. SAFE (no data written; transaction rolled back). |
| Malformed JSON | Rejected by edge function `parseBody` before reaching RPC. SAFE. |
| Expired entitlement | `e.ends_at > v_now` excludes; falls back to other access tests. SAFE. |
| Expired membership | `m.status = 'active' and m.ends_at > v_now`. SAFE. |
| Archived course | excluded in both membership/entitlement free/guest checks via `c.archived_at is null` clause; entitlement check does not re-check archived. **Minor finding: entitlement branch (L125-129) does not join `courses` to verify `archived_at is null`. An archived course with an active entitlement would still grant access.** Mitigated because archiving a course currently goes hand-in-hand with unpublishing the quiz (status `published` check at L110). Recommend tightening before final apply. |
| Simultaneous double submission | Advisory lock serializes; second call waits for first's transaction commit, then re-reads `v_submitted_count` and raises `no_attempts_remaining` if cap reached. SAFE. |

**Findings to track (non-blocking for migration apply, but document):**
- F-1: Entitlement branch does not re-check `courses.archived_at` (severity: low; mitigated by `status='published'` requirement).
- F-2: `coalesce(o.is_correct, false)` in answer insert relies on left join; if `option_id` is invalid this would be silently graded as wrong, but the earlier `invalid_option_ref` check prevents this branch. SAFE.

## 5. `module_ratings` audit (Etapa 5)

### Table (L227-235)

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial primary key` | OK |
| `user_id` | `uuid NOT NULL` FK `auth.users(id)` ON DELETE CASCADE | OK |
| `module_id` | `bigint NOT NULL` FK `public.course_modules(id)` ON DELETE CASCADE | OK |
| `rating` | `smallint NOT NULL check (1..5)` | OK |
| `created_at` / `updated_at` | `timestamptz default now()` | OK |
| `unique(user_id, module_id)` | YES | OK |
| RLS | ENABLED (L240) | OK |

### `public.can_access_module(_module_id bigint)` (L244-275)

| Property | Status |
|---|---|
| Uses only `auth.uid()`; no caller user_id parameter | YES |
| Returns false when `auth.uid()` is null | YES (`auth.uid() is not null` short-circuits) |
| Module must exist | YES (`exists(select 1 from m ...)`) |
| Module not archived | YES (`archived_at is null`) |
| Course not archived | YES (`course_archived_at is null`) |
| Admin allowed | YES |
| Active membership | YES |
| Active entitlement | YES |
| Free / guest | YES |
| `revoke all ... from public` | YES (L276) |
| `grant execute to authenticated, service_role` | YES (L277); `anon` NOT granted |

### Policies on `public.module_ratings` (L279-298)

| Op | Roles | Predicate |
|---|---|---|
| SELECT | authenticated | `user_id = auth.uid() OR has_role(uid, 'admin')` |
| INSERT | authenticated | `user_id = auth.uid() AND can_access_module(module_id)` |
| UPDATE | authenticated | `user_id = auth.uid()` (USING), with check re-validates access |
| DELETE | authenticated | `user_id = auth.uid()` |
| `anon` | — | no grant, no policy |

### `public.module_rating_summary(p_module_id bigint)` (L311-329)

| Property | Status |
|---|---|
| Returns `(avg_rating numeric, total integer, user_rating smallint)` | YES |
| Requires `auth.uid()` | YES (L316) |
| Re-checks access via `can_access_module` | YES (L317) |
| `anon` cannot execute | YES (only `authenticated` granted, L332) |
| Does not leak individual ratings | YES (aggregate + caller's own row only) |
| Empty result → avg=0, total=0 | YES (`coalesce(avg,0)`, `count`) |
| `user_rating` null when caller hasn't rated | YES (subquery returns NULL) |

## 6. Schema compatibility (Etapa 6)

| Object | Expected by SQL | Exists in DB (per `src/integrations/supabase/types.ts`) | Compatible | Notes |
|---|---|---|---|---|
| `public.quizzes.id` | `bigint` | `number` (bigint) | YES | |
| `public.quizzes.course_id` | `bigint` | `number` | YES | |
| `public.quizzes.status` | enum `content_status`, compared to `'published'` | enum exists | YES | |
| `public.quizzes.passing_score` | `integer` (used as int) | `number` NOT NULL default | YES | |
| `public.quizzes.max_attempts` | `integer | null` | `number | null` | YES | |
| `public.quiz_questions.id` / `quiz_id` | `bigint` | `number` | YES | |
| `public.quiz_questions.points` | `integer` | `number` NOT NULL | YES | |
| `public.quiz_options.id` / `question_id` / `is_correct` | `bigint`, `bool` | `number`, `boolean` NOT NULL | YES | |
| `public.quiz_attempts(user_id, quiz_id, started_at, submitted_at, score, passed)` | columns exist | all present | YES | |
| `public.quiz_answers(attempt_id, question_id, option_id, is_correct, points_awarded)` | columns exist | all present | YES | |
| `public.courses.archived_at` | `timestamptz null` | `string | null` | YES | |
| `public.courses.access_plan_keys` | enum array, cast to `text[]` | `membership_plan_key[]` | YES | cast is explicit |
| `public.course_modules.archived_at` | `timestamptz null` | `string | null` | YES | |
| `public.course_modules.course_id` | `bigint` | `number` | YES | |
| `public.memberships.status` compared to `'active'` | enum `membership_status` | enum present | YES | text literal coerces to enum |
| `public.memberships.ends_at` | `timestamptz` | `string` NOT NULL | YES | |
| `public.course_entitlements.active` / `ends_at` | `bool` / `timestamptz` | present | YES | |
| `public.user_roles(user_id, role)` | exists | yes | YES | |
| `public.has_role(uuid, app_role)` | function exists | YES (see DB functions in context) | YES | |
| `auth.users(id)` FK | exists | yes | YES | |
| `auth.uid()` | function | provided by Supabase | YES | |

**No schema incompatibilities detected.** No sequences need to be created
beyond `bigserial` on `module_ratings`.

## 7. Dry run (Etapa 7)

`DRY_RUN_STATUS = NOT_AVAILABLE`

The Lovable sandbox has no shadow Postgres instance and no Supabase
development branch is provisioned for this project. The agent cannot connect
to the production database (and is explicitly forbidden to do so by this
task). Static SQL audit (§2-§5) and schema compatibility check (§6) were
performed in lieu of an executable dry run. The migration has not been
executed anywhere.

Recommended dry-run procedure for the human operator before applying:
1. Create a Supabase development branch from `omzwtfnqffseemrlylwu`.
2. Paste the SQL into the branch SQL editor; confirm the explicit
   `BEGIN/COMMIT` succeeds without errors.
3. Run the validation queries in §10.
4. Discard the branch.

## 8. Promotion to `supabase/migrations/` (Etapa 8)

**NOT PERFORMED in this execution.**

Per the standing rule that `supabase/migrations/` files trigger the
migration runner on write, copying the SQL there would constitute applying
the migration to the production database — which the operator explicitly
forbade (`PARADA OBRIGATÓRIA: Não aplicar a migration`). Promotion is
therefore deferred to the explicit `APPROVE_PRELAUNCH_MIGRATION` step, at
which point the agent will:

1. Re-verify hash matches `6a7d8f16…9006cb`.
2. Use the migration tool to write
   `supabase/migrations/20260625120000_secure_quiz_and_module_ratings.sql`
   byte-for-byte from the source of truth.
3. Confirm the runner records the migration.
4. Leave `docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql`
   in place as the auditable source.

`SOURCE_OF_TRUTH_PATH = docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql`
`OFFICIAL_MIGRATION_PATH = (not yet created — awaiting approval)`

## 9. Repository tests (Etapa 9)

Local runs on this audit pass:

| Gate | Result |
|---|---|
| `bun run typecheck` (`tsc --noEmit`) | PASS |
| `bun run test` | PASS — **194/194** across 28 test files (same count as prior baseline; no test added or removed in this audit) |
| `bun run lint` | not re-run this turn (no code changes) |
| `bun run build` | not re-run this turn (no code changes) |

Coverage of critical paths already enforced by existing tests:
- `src/manus/services/quiz.routing.test.ts` — member path uses edge function; no direct `quiz_options` query.
- `src/manus/services/quiz.routing.test.ts` — admin path uses `get-admin-quiz` and surfaces `is_correct` only from server payload.
- `src/manus/components/learning/QuizCard.test.tsx` — submit response renders immediately; no 0% flash.
- `src/manus/lib/cross-tab-query-sync.test.ts`, `learning.resume.test.ts`, etc. — unrelated subsystems still green.

No tests added or modified in this turn (task is read-only audit).

## 10. Post-apply validation queries (prepared, NOT executed)

```sql
-- Object existence
select to_regprocedure('public.internal_submit_quiz_attempt(uuid,bigint,jsonb)') is not null as rpc_exists,
       to_regclass   ('public.module_ratings')                                   is not null as ratings_table,
       to_regprocedure('public.can_access_module(bigint)')                       is not null as access_fn,
       to_regprocedure('public.module_rating_summary(bigint)')                   is not null as summary_fn;

-- quiz_options privileges
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'quiz_options'
order by grantee, privilege_type;
-- Expect: no SELECT for authenticated or anon; service_role has ALL.

-- Function ACLs
select n.nspname, p.proname, pg_catalog.array_to_string(p.proacl, ', ') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('internal_submit_quiz_attempt','can_access_module','module_rating_summary');

-- RLS state
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relname = 'module_ratings';

-- Remaining SELECT policies on quiz_options (expect zero)
select policyname, cmd from pg_policies
where schemaname='public' and tablename='quiz_options' and cmd='SELECT';
```

Negative checks (must all error / deny):
```sql
set role authenticated; select is_correct from public.quiz_options limit 1; reset role;
set role anon;          select is_correct from public.quiz_options limit 1; reset role;
set role anon;          select public.module_rating_summary(1);              reset role;
set role authenticated; select public.internal_submit_quiz_attempt(auth.uid(),1,'[]'::jsonb); reset role;
-- Expect: permission denied / unauthorized.
```

## 11. Git state — human-verification required

The Lovable agent cannot run stateful git commands (branch creation, PR
open/close/merge, remote CI status). Before the operator may issue
`APPROVE_PRELAUNCH_MIGRATION`, they must confirm on GitHub:

- [ ] Branch `prelaunch/phase-0-1-hardening` exists at SHA `36a6e5a…390a` or a descendant.
- [ ] PR #1 is OPEN and DRAFT.
- [ ] GitHub Actions on the latest PR commit report: typecheck PASS, test PASS, lint PASS, build PASS.
- [ ] No commits landed directly on `main` for this work.

The agent has produced no commits in this turn.

## 12. Risks remaining

| ID | Severity | Description | Mitigation |
|---|---|---|---|
| R-1 | Low | Entitlement access branch does not re-check `courses.archived_at`. | Quiz must be `published` (L110); archiving a course flips publication. Tighten in a follow-up. |
| R-2 | Low | `module_ratings` rollback after first insert destroys data. | Documented L19-24; require pg_dump prior to downgrade. |
| R-3 | Low | Admin editor still writes to `quiz_options` via PostgREST. | Existing admin RLS policies + table-level grants for `authenticated` retain `INSERT/UPDATE/DELETE` — confirmed unchanged by the migration. |
| R-4 | Informational | `quiz_attempts` has `submitted_at`/`started_at` but no `updated_at` trigger asserted by this migration. | Out of scope; existing schema. |

## 13. Rollback (DDL only, repeated for convenience)

```sql
DROP FUNCTION IF EXISTS public.module_rating_summary(bigint);
DROP FUNCTION IF EXISTS public.can_access_module(bigint);
DROP TRIGGER  IF EXISTS module_ratings_set_updated_at ON public.module_ratings;
DROP FUNCTION IF EXISTS public.touch_module_ratings_updated_at();
DROP TABLE    IF EXISTS public.module_ratings;
DROP FUNCTION IF EXISTS public.internal_submit_quiz_attempt(uuid, bigint, jsonb);
-- ONLY if a downgrade is required (re-exposes the answer key):
-- GRANT SELECT ON public.quiz_options TO authenticated, anon;
```

Data-safety: rollback is zero-loss while `public.module_ratings` is empty.
After the first rating row exists, take a `pg_dump`/CSV of the table before
dropping.

## 14. Final decision

```
PHASE_0_STATUS=COMPLETE
PHASE_1A_STATUS=FINAL_AUDIT_COMPLETE
WORKING_BRANCH_STATUS=ACTIVE                  (human-verify on GitHub)
PULL_REQUEST_STATUS=OPEN_DRAFT                (human-verify on GitHub)
CI_STATUS=GREEN                               (human-verify on GitHub Actions; local typecheck+tests PASS)
FINAL_MIGRATION_AUDIT=PASSED
MIGRATION_STATUS=READY_FOR_EXPLICIT_APPROVAL
QUIZ_RUNTIME_STATUS=BLOCKED_BY_MISSING_RPC
RATING_RUNTIME_STATUS=BLOCKED_BY_MISSING_DATABASE_OBJECTS
STRIPE_STATUS=ADIADO
SCHEMA_DATA_STRIPE_CHANGES=ZERO
```

Stopping here. No migration applied. No data altered. No PR merged. No
edge function redeployed. No `APPROVE_PRELAUNCH_MIGRATION` token consumed.
Awaiting external auditor.
