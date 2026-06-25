# Phase 2 — Quiz Security Hardening

Status: `IMPLEMENTED_PENDING_RUNTIME_QA`.
Quiz status: stays at `SECURE_RENDERED_PENDING_RUNTIME_VALIDATION` until the
hosted-preview QA accounts (qa-member, qa-entitlement, qa-no-access) have run
through a real submission. Will be promoted to
`SECURE_RENDERED_AND_RUNTIME_VALIDATED` only after that runtime pass.

## Threat that was open

`src/manus/services/quiz.ts::submitAttempt` called `loadAdminQuiz`, which
selected `quiz_options.is_correct`. With the previous RLS, any authenticated
member could replay that same select via PostgREST and read the answer key
before submitting — full quiz bypass.

## Mitigations now in code

1. **Server-side grading via Edge Function `submit-quiz-attempt`**
   - File: `supabase/functions/submit-quiz-attempt/index.ts`
   - Validates JWT (`auth.getUser(token)`).
   - Validates the quiz is `status='published'`.
   - Validates the caller's access (admin role OR active membership OR active
     entitlement for `quiz.course_id`).
   - Validates every `question_id` belongs to the quiz and every `option_id`
     belongs to its question.
   - Enforces `max_attempts` (admins exempt for preview).
   - Grades using `is_correct` read with `service_role` only.
   - Persists `quiz_attempts` + `quiz_answers` in one logical flow.
   - Returns `{ score, passed, attempts_remaining }` — **never** `is_correct`.

2. **Client refactor**
   - `submitAttempt` no longer calls `loadAdminQuiz`. It posts to the edge
     function via `supabase.functions.invoke('submit-quiz-attempt', ...)`.
   - `QuizCard` (member flow) only uses `loadMemberQuiz`, which selects
     `id, question_id, option_text, sort_order` — **no `is_correct`**.

3. **Column-level RLS — `docs/migrations/20260625000000_secure_quiz_options_and_module_ratings.sql`**
   - `REVOKE SELECT (is_correct) ON public.quiz_options FROM authenticated, anon;`
   - Safe columns re-granted explicitly to `authenticated` and `anon`.
   - `service_role` keeps full access (used by the edge function only).
   - **This migration MUST be applied via the Supabase SQL Editor before the
     hosted-preview QA pass.** Without it, the answer key remains readable
     even though no client code requests it.

## Admin preview path (unchanged, still safe)

`QuizCard previewAsAdmin` calls `loadAdminQuiz` and grades locally for the
admin only. The admin already legitimately reads `is_correct` (admin SELECT
policies on `quiz_options`). It never writes a `quiz_attempts` row.

## RPC contract

`POST /functions/v1/submit-quiz-attempt`

Request:
```json
{ "quiz_id": 12, "answers": [{ "question_id": 34, "option_id": 56 }] }
```

Responses:
- `200 { score, passed, attempts_remaining }`
- `400 { error: "invalid_question_ref" | "invalid_option_ref" | "invalid_json" | … }`
- `401 { error: "unauthorized" }`
- `403 { error: "forbidden" }`
- `404 { error: "quiz_unavailable" }`
- `409 { error: "no_attempts_remaining" }`

## Verification checklist (post-migration)

- [ ] `select is_correct from quiz_options limit 1` as `authenticated` → permission error.
- [ ] `select id, option_text from quiz_options limit 1` as `authenticated` → returns rows for published quizzes the user can access.
- [ ] Submit attempt as member → `quiz_attempts` row created, score matches server truth.
- [ ] Submit attempt without access → `403 forbidden`.
- [ ] Submit past `max_attempts` → `409 no_attempts_remaining`.
