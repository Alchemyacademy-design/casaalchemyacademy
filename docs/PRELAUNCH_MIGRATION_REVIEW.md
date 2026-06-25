# PRELAUNCH MIGRATION REVIEW — secure_quiz_and_module_ratings

> Pre-validation review. The migration is **NOT applied**. Awaiting explicit
> `APPROVE_PRELAUNCH_MIGRATION` token from the auditor before promotion to
> `supabase/migrations/` and execution.

## 1. Identification

| Field | Value |
|---|---|
| Source SQL (source of truth) | `docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql` |
| Intended final path | `supabase/migrations/20260625120000_secure_quiz_and_module_ratings.sql` |
| SHA-256 of SQL file | `dd3c6b5e6e07fcc13b5ffad49103059725c16ffc2542c5e82e1410697dd5c52b` |
| Line count | 308 |
| Idempotency | YES — `create or replace`, `if not exists`, `drop policy if exists`, `drop trigger if exists`. |
| Transactional | YES — runs as a single migration; failure rolls back DDL. |
| Touches Stripe | NO |
| Inserts pilot data | NO |
| Removes/updates existing rows | NO |
| Touches reserved schemas (`auth`, `storage`, etc.) | NO (only FK references to `auth.users.id`, no DDL on those schemas) |
| `search_path` hygiene | YES — `set search_path = ''` on every SECURITY DEFINER function |
| Hard-coded user/content IDs | NONE |

## 2. Objects created

| Kind | Object | Notes |
|---|---|---|
| Table | `public.module_ratings` | unique(`user_id`, `module_id`), check `rating between 1 and 5`, FKs to `auth.users` and `public.course_modules` (both ON DELETE CASCADE), `created_at`/`updated_at` defaults |
| Function | `public.internal_submit_quiz_attempt(uuid, bigint, jsonb)` | SECURITY DEFINER, service-role only |
| Function | `public.can_access_module(uuid, bigint) returns boolean` | SECURITY DEFINER, stable |
| Function | `public.module_rating_summary(bigint)` | SECURITY DEFINER, stable; requires `auth.uid()` + access |
| Function | `public.touch_module_ratings_updated_at()` | trigger fn |
| Trigger | `module_ratings_set_updated_at` BEFORE UPDATE ON `public.module_ratings` | |
| Policies (4) | `module_ratings_select_own`, `module_ratings_insert_own`, `module_ratings_update_own`, `module_ratings_delete_own` | `auth.uid()` scoped; insert/update gated by `can_access_module` |

## 3. Objects altered

| Kind | Object | Change |
|---|---|---|
| Privilege | `SELECT` on `public.quiz_options` | **REVOKED** from `authenticated` and `anon` (table-level). `service_role` retains `ALL`. |
| Policies | Any existing member SELECT policy on `public.quiz_options` | Dropped via dynamic loop (admin write policies preserved). |

## 4. Grants matrix — before vs after

| Object | Role | Before | After |
|---|---|---|---|
| `public.quiz_options` (table) | `authenticated` | `SELECT, INSERT, UPDATE, DELETE` (default Supabase grants from prior phase migrations) | `INSERT, UPDATE, DELETE` only (admin policies still gate writes) |
| `public.quiz_options` (table) | `anon` | `SELECT` (default) | none |
| `public.quiz_options` (table) | `service_role` | `ALL` | `ALL` |
| `public.module_ratings` (new) | `authenticated` | — | `SELECT, INSERT, UPDATE, DELETE` (RLS enforces row scope + access) |
| `public.module_ratings` (new) | `service_role` | — | `ALL` |
| `public.module_ratings` (new) | `anon` | — | none |
| `internal_submit_quiz_attempt(uuid,bigint,jsonb)` | `public` | — | revoked |
| `internal_submit_quiz_attempt(uuid,bigint,jsonb)` | `service_role` | — | `EXECUTE` |
| `internal_submit_quiz_attempt(uuid,bigint,jsonb)` | `authenticated`, `anon` | — | **none** (called only via service-role from `submit-quiz-attempt` edge function) |
| `can_access_module(uuid,bigint)` | `public` | — | revoked |
| `can_access_module(uuid,bigint)` | `authenticated`, `service_role` | — | `EXECUTE` |
| `module_rating_summary(bigint)` | `public` | — | revoked |
| `module_rating_summary(bigint)` | `authenticated` | — | `EXECUTE` |
| `module_rating_summary(bigint)` | `anon` | — | **none** (intentional) |

## 5. Policies — before vs after

### `public.quiz_options`
- Before: ≥1 SELECT policy allowing authenticated members to read options (and therefore `is_correct`).
- After: zero SELECT policies; reads possible only via service-role through the edge functions.
- Admin INSERT/UPDATE/DELETE policies: unchanged.

### `public.module_ratings`
- Before: table does not exist.
- After:
  - `SELECT` — own row OR `has_role(auth.uid(),'admin')`.
  - `INSERT` — `user_id = auth.uid()` AND `can_access_module(auth.uid(), module_id)`.
  - `UPDATE` — own row, plus access re-check on `WITH CHECK`.
  - `DELETE` — own row.
  - `anon`: no policies, no grants → fully denied.

## 6. Risk assessment & rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing frontend code calls `supabase.from('quiz_options').select(...)` and breaks after REVOKE | Low | `src/manus/services/quiz.routing.test.ts` enforces edge-only routing; `loadMemberQuiz`/`loadAdminQuiz` go through edge functions; verified in current repo. |
| RPC name collision | None | Single new RPC; uses `create or replace`. |
| `auth.users` FK cascade unintentionally deletes ratings | Intentional behavior; matches existing project convention | — |
| Long migration locks `quiz_options` heavily during REVOKE | Negligible at current scale | — |
| Edge functions cannot find RPC after redeploy ordering issue | Mitigated by ordered redeploy step (see §7) | — |

Rollback (no data loss — DDL only):
```sql
DROP FUNCTION IF EXISTS public.module_rating_summary(bigint);
DROP FUNCTION IF EXISTS public.can_access_module(uuid, bigint);
DROP TRIGGER  IF EXISTS module_ratings_set_updated_at ON public.module_ratings;
DROP FUNCTION IF EXISTS public.touch_module_ratings_updated_at();
DROP TABLE    IF EXISTS public.module_ratings;
DROP FUNCTION IF EXISTS public.internal_submit_quiz_attempt(uuid, bigint, jsonb);
-- Only if explicitly required (NOT recommended — re-exposes answer key):
-- GRANT SELECT ON public.quiz_options TO authenticated, anon;
```

## 7. Post-apply validation queries

```sql
-- Object existence
select to_regprocedure('public.internal_submit_quiz_attempt(uuid,bigint,jsonb)') is not null  as rpc_quiz_exists,
       to_regclass   ('public.module_ratings')                                   is not null  as table_ratings_exists,
       to_regprocedure('public.module_rating_summary(bigint)')                   is not null  as fn_summary_exists,
       to_regprocedure('public.can_access_module(uuid,bigint)')                  is not null  as fn_access_exists;

-- Privilege state on quiz_options
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'quiz_options'
order by grantee, privilege_type;
-- Expected: authenticated has no SELECT; anon absent or no SELECT; service_role has ALL.

-- Function grants
select n.nspname, p.proname, pg_catalog.array_to_string(p.proacl,', ') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('internal_submit_quiz_attempt','can_access_module','module_rating_summary');
```

Negative checks (must all return permission errors):
```sql
set role authenticated; select is_correct from public.quiz_options limit 1; reset role;  -- expect: permission denied
set role anon;          select is_correct from public.quiz_options limit 1; reset role;  -- expect: permission denied
set role anon;          select public.module_rating_summary(1);              reset role;  -- expect: permission denied
```

## 8. Promotion instructions (manual — DO NOT run before approval)

Because the agent cannot write under `supabase/migrations/` directly:

1. Auditor reviews this document and the SQL file (SHA above).
2. Auditor replies with the literal token `APPROVE_PRELAUNCH_MIGRATION`.
3. After approval, copy the file:
   ```bash
   cp docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql \
      supabase/migrations/20260625120000_secure_quiz_and_module_ratings.sql
   ```
   or apply via the Supabase SQL Editor and then place the same file under
   `supabase/migrations/` so the runner records it.
4. Run the validation queries in §7.
5. Redeploy edge functions in this order: `get-member-quiz`, `get-admin-quiz`,
   `submit-quiz-attempt`.
6. Re-run the Supabase Security Advisors and update the baseline doc.

## 9. Data-safety statement

This migration **does not**:
- delete, update, or insert any application row;
- alter the schema of existing tables other than revoking privileges on
  `public.quiz_options`;
- touch Stripe tables, secrets, or webhook configuration;
- modify any user, role assignment, course, module, lesson, quiz, membership,
  or entitlement record.

## 10. Status

```
MIGRATION_STATUS=AWAITING_APPROVAL
NEXT_COMMAND_REQUIRED=APPROVE_PRELAUNCH_MIGRATION
```
