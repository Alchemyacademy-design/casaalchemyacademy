# Phase 2 — Quiz Security Hardening

Status: `QUIZ_SECURITY_STATUS = READY_FOR_MIGRATION_REVIEW`.
Related flags (unchanged this round):
- `STUDENT_JOURNEY_STATUS = IMPLEMENTED_PENDING_RUNTIME_QA`
- `RATING_STATUS = IMPLEMENTED_PENDING_MIGRATION`
- `PILOT_QUIZ_CONTENT = AWAITING_ADMIN_APPROVAL`
- `STRIPE_STATUS = ADIADO`

## Threat that was open

`src/manus/services/quiz.ts::loadAdminQuiz` ran a PostgREST select that
included `quiz_options.is_correct`. The earlier mitigation only ran
`REVOKE SELECT (is_correct)`, which does not undo a pre-existing table-level
SELECT grant — any authenticated member could replay the same select against
PostgREST and read the answer key before submitting.

## Architecture now (code)

1. **`get-member-quiz` edge function** (`supabase/functions/get-member-quiz/`)
   - Validates JWT.
   - Validates quiz is `status='published'`.
   - Validates access via the canonical helper
     `supabase/functions/_shared/quiz-access.ts::evaluateCourseAccess`
     (admin OR active membership OR active entitlement OR course is open-access).
   - Reads quiz + questions + options through service-role and returns
     **only** the member-safe option fields (`id, question_id, option_text,
     sort_order`). `is_correct` is never serialised.

2. **`get-admin-quiz` edge function** (`supabase/functions/get-admin-quiz/`)
   - Validates JWT, requires admin role via the shared helper.
   - Returns `is_correct` for the editor and admin preview.
   - Non-admins get `403`.

3. **`submit-quiz-attempt` edge function** — now a thin wrapper around the
   SECURITY DEFINER RPC `public.internal_submit_quiz_attempt(uuid, bigint, jsonb)`.
   It only authenticates, shape-checks the body, calls the RPC, and maps
   raised error tokens (`quiz_unavailable`, `forbidden`,
   `no_attempts_remaining`, `admin_preview_blocked`, `invalid_question_ref`,
   `invalid_option_ref`, `duplicate_question`, `missing_answer`,
   `extra_answer`) to safe public codes. SQL errors are logged server-side
   only and surfaced to the client as `submission_failed`.

4. **Transactional grading RPC** (defined in
   `docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql`,
   pending review).
   - `pg_advisory_xact_lock` keyed on `(user_id, quiz_id)` serialises
     concurrent submissions, enforcing `max_attempts` under contention.
   - Re-verifies access using the same access rule.
   - Rejects admin callers (`admin_preview_blocked`) — admin preview must
     never write attempts.
   - Validates exactly one answer per question (no duplicates, no missing
     answers, no foreign question/option refs).
   - Inserts `quiz_attempts` + `quiz_answers` in the same transaction;
     any failure rolls the attempt back.
   - Returns `{ score, passed, attempts_remaining }` only — `is_correct`
     never re-crosses the boundary.

5. **Frontend** (`src/manus/services/quiz.ts`)
   - `loadMemberQuiz` → `supabase.functions.invoke('get-member-quiz', …)`.
   - `loadAdminQuiz` → `supabase.functions.invoke('get-admin-quiz', …)`.
   - The browser no longer queries `quiz_options` directly.
   - `QuizCard` stores the edge function's `{ score, passed, attemptsRemaining }`
     in local state and renders it immediately — no transient 0% flash while
     the attempts history refetches in the background.

## Database hardening (migration pending review)

Authoritative file:
`docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql`.
Earlier file `docs/migrations/20260625000000_*.sql` is now a stub that
points here.

Key changes the migration applies (not yet executed):

- `REVOKE SELECT ON TABLE public.quiz_options FROM authenticated, anon;`
  This is the critical step the previous draft missed.
- Drops any SELECT RLS policy on `quiz_options` so the table is reachable
  only via service-role (the three edge functions above).
- Creates `public.internal_submit_quiz_attempt(uuid, bigint, jsonb)` —
  SECURITY DEFINER, `search_path=''`, `service_role`-only EXECUTE.
- Creates `public.module_ratings` with grants + RLS, plus
  `public.can_access_module(uuid, bigint)` so INSERT/UPDATE policies require
  the rater to actually have access to the underlying course.
- Creates `public.module_rating_summary(bigint)` (SECURITY DEFINER) that
  checks `can_access_module` before returning the average. `anon` is
  intentionally NOT granted EXECUTE.

## Verification (this round)

- `bun run typecheck` — clean.
- `bun run lint` — 0 errors (17 pre-existing warnings).
- `bun run test` — **194 passed (previously 189)**.
- `bun run build` — entry index 137.30 kB, build successful.

New tests (5 added):
- `src/manus/services/quiz.routing.test.ts` (4 tests) — asserts member and
  admin loads route through the edge functions, never `supabase.from(...)`;
  member payload contains no `is_correct`.
- `src/manus/components/learning/QuizCard.test.tsx` (1 test) — submits a
  quiz and asserts the score renders straight from the edge response even
  when the attempts refetch returns no history (no 0% flash).

## What still requires action before runtime QA

1. Apply `docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql`
   via the Supabase SQL Editor. The Lovable migration runner refuses
   direct file writes under `supabase/migrations/`; copy/apply manually.
2. Approve the colour-theory pilot quiz in
   `docs/PHASE_2_PILOT_QUIZ_PROPOSAL.md` with **APPROVE_PILOT_QUIZ**.
3. Run the QA personas described in `docs/PHASE_2_QA_RUNBOOK.md` against
   the hosted preview.

Stripe remains `ADIADO` — no changes this round.
