# Premortem — Student Journey & Quiz Hardening (Phase 2 Closure)

Status target before runtime QA: `STUDENT_JOURNEY_STATUS = IMPLEMENTED_PENDING_RUNTIME_QA`.
Quiz status target: `SECURE_RENDERED_AND_RUNTIME_VALIDATED` (only after hosted-preview runs with real QA accounts).

Stripe stays off. No pilot quiz content will be written without explicit approval. No QA users created in this execution.

---

## Premortem — what will go wrong if we skip a step

1. **Client-side grading leaks `is_correct`.** Today `submitAttempt` calls `loadAdminQuiz` which selects `is_correct` from `quiz_options`. Any authenticated user can read correct answers via PostgREST before submitting. **P0 security bug.**
2. **RLS on `quiz_options` likely allows authenticated read.** Even after we move grading server-side, if RLS is not tightened the leak persists. Must audit + lock.
3. **`max_attempts` and `published` are enforced in the browser.** A crafted request bypasses both. Must move to RPC/Edge with `SECURITY DEFINER`.
4. **"Admin preview only" pages mislead audit.** CourseDetail/ModuleDetail must render the real journey for paying members, not just an admin banner.
5. **No `module_ratings` table.** Rating UI without schema = fake. Need migration + RLS + aggregation.
6. **Cross-tab/route guards untested for the three personas** (no-access, membership, entitlement). Without RTL tests we cannot claim the journey works.
7. **Runtime QA conflated with unit tests.** Gates require hosted-preview runs; we will *not* declare VALIDATED here.

---

## Scope of this execution

### A. Secure quiz submission (P0)
- New Edge Function `submit-quiz-attempt` (verify_jwt validation in code, CORS, Zod input).
  - Resolves `auth.uid()` from the JWT.
  - Loads quiz + questions + options with the **service role** (server-only) and checks: `status='published'`, user has membership OR entitlement for `course_id` OR is admin, every `question_id` belongs to the quiz, every `option_id` belongs to its question, `submitted` attempts < `max_attempts`.
  - Grades server-side, inserts `quiz_attempts` + `quiz_answers` in one logical flow.
  - Returns `{ score, passed, attempts_remaining }`. Never returns `is_correct` for unsubmitted state.
- Refactor `src/manus/services/quiz.ts`:
  - `submitAttempt` → calls the edge function via `supabase.functions.invoke`.
  - `loadMemberQuiz` keeps the existing **no-`is_correct`** select; remove any code path where members touch `loadAdminQuiz`.
  - `QuizCard` no longer imports `loadAdminQuiz` for member flows; admin preview path stays guarded by `isAdmin`.
- RLS migration on `quiz_options` and `quiz_questions`:
  - Members may read `quiz_options(id, question_id, option_text, sort_order)` of **published** quizzes they have access to, **excluding** `is_correct` — enforced by revoking column privilege on `is_correct` from `authenticated` and granting only the safe columns. Admin keeps full read via `has_role(auth.uid(),'admin')`.
  - Audit and re-issue GRANTs in the same migration.

### B. Real student rendering on `/courses/:id` and `/modules/:id`
- `CourseDetail` renders, for users with access: hero, About, lessons list, **inline Quiz (real submission)**, **Rating**, sidebar of modules. Loading/error/empty states use `QueryStateView`.
- `ModuleDetail` renders: `LessonSidebar`, video, materials, Mark Complete, Previous / `Lesson X of Y` / Next, progress. Admin-preview banner becomes additive, never a replacement.
- Access gating leaves `GlobalAccessController` unchanged but ensures CourseDetail returns a neutral "Course unavailable or you do not have access" surface when the access check fails inside the page (defense in depth).

### C. Quiz visual to PDF spec
- White card, `Instrument Serif` heading `Quiz: Question X of Y`, A/B/C/D options with selection state, Previous (left) / `X / Y` (center) / Next (right), Submit on last, states for loading/error/Retry/submitting/passed/failed/attempts/Restart. Tokens only — no DM Sans.

### D. Real ratings
- Migration `module_ratings(id, user_id uuid → auth.users, module_id bigint → course_modules, rating smallint CHECK 1..5, created_at, updated_at, UNIQUE(user_id, module_id))` with grants + RLS:
  - `authenticated` may `SELECT` own row and `INSERT/UPDATE` where `user_id = auth.uid()`.
  - Aggregates via `SECURITY DEFINER` function `module_rating_summary(module_id) → (avg numeric, count int)` so members never read other rows.
  - Admin read-all via `has_role`.
- UI component `ModuleRating` with 5 stars, "Your rating", average, count, loading/error/Retry/empty.

### E. Tests (Vitest + RTL)
- `quiz.service` test: client `submitAttempt` calls edge function, never reads `is_correct`.
- `QuizCard` test: renders PDF structure, disables Submit until all answered, surfaces server result.
- `CourseDetail` test per persona: no-access → neutral message; membership → full render; entitlement → only owned course; admin → drafts visible with preview badge but no attempt write.
- `ModuleRating` test: optimistic update, error retry, anonymous aggregate read.
- Edge function Deno tests for `submit-quiz-attempt`: rejects unpublished quiz, foreign question, exceeded attempts, no access; grades correctly.

### F. Pilot quiz content (PROPOSAL ONLY — no DB write)
- Deliver markdown proposal in `docs/PHASE_2_PILOT_QUIZ_PROPOSAL.md` with title, description, 5 questions × 4 options, correct option marked, explanation, points, `passing_score=70`, `max_attempts=3`. **Stop and wait for approval before any insert.**

### G. Documentation
- `docs/PHASE_2_STUDENT_JOURNEY.md` — access model, route map, statuses.
- `docs/PHASE_2_QUIZ_SECURITY.md` — threat model, RPC contract, RLS diff.
- `docs/PHASE_2_QA_RUNBOOK.md` — procedure for qa-member, qa-entitlement, qa-no-access (to be executed later).
- Update `docs/PHASE_2_VISUAL_ACCEPTANCE.md` and `docs/PHASE_2_COMPLETION_REPORT.md` with the new statuses.

### H. Gates (run locally; hosted-preview runtime QA is a separate later step)
- `bun run typecheck`, `bun run test`, `bun run lint`, `bun run build`.
- Verify zero Stripe calls in changed paths.
- Manual hosted-preview validation deferred — status stays `IMPLEMENTED_PENDING_RUNTIME_QA`.

---

## Out of scope (explicit)
- Creating qa-* users or seeding any pilot quiz rows.
- Stripe configuration or live mode.
- Phase 4.
- Any change to `auth`, `storage`, `realtime` schemas.

---

## Technical details

**Edge function** `supabase/functions/submit-quiz-attempt/index.ts`
- CORS via `npm:@supabase/supabase-js@2/cors`.
- Zod body: `{ quiz_id: number, answers: { question_id: number, option_id: number }[] }`.
- Validate JWT via `supabase.auth.getUser(token)` using anon client; then use service-role client for data.
- Access check: `has_role(uid,'admin')` OR active membership row OR active `course_entitlements` row for the quiz's `course_id`.
- Returns 200 `{ score, passed, attempts_remaining }`, 400 on validation, 403 on access, 409 on `max_attempts`.

**RLS migration** (`docs/migrations/<ts>_secure_quiz_options_and_module_ratings.sql`)
- `REVOKE SELECT (is_correct) ON public.quiz_options FROM authenticated;`
- `GRANT SELECT (id, question_id, option_text, sort_order) ON public.quiz_options TO authenticated;`
- Keep admin-readable via existing `has_role` policy (verify and tighten if needed).
- `CREATE TABLE public.module_ratings(...)` + GRANT + RLS + policies + `module_rating_summary` SECURITY DEFINER function with `GRANT EXECUTE TO authenticated, anon`.

**Client changes**
- `src/manus/services/quiz.ts`: replace `submitAttempt` body with `supabase.functions.invoke('submit-quiz-attempt', { body })`. Remove `loadAdminQuiz` call from member flow.
- `src/manus/components/learning/QuizCard.tsx`: keep current UX, route grading through new service.
- `src/manus/components/learning/ModuleRating.tsx`: new file.
- `CourseDetail.tsx` / `ModuleDetail.tsx`: render quiz + rating inline alongside existing structure.

**Risks & mitigations**
- *Edge function cold start latency* — acceptable; loading state covered.
- *RLS regression on `quiz_options`* — column-level revoke is reversible; add Deno test that anon/authenticated SELECT of `is_correct` fails.
- *Rating aggregate exposure* — only avg/count exposed, never per-user rows.

---

## Deliverables checklist
- [ ] Edge function `submit-quiz-attempt` + Deno tests
- [ ] Migration: `quiz_options` column-level RLS + `module_ratings` table/RLS/function
- [ ] Service refactor (`quiz.ts`) + `ModuleRating` component
- [ ] CourseDetail / ModuleDetail integrate Quiz + Rating on real routes
- [ ] PDF-spec visual pass on QuizCard
- [ ] Persona RTL tests (no-access, membership, entitlement, admin)
- [ ] Docs: STUDENT_JOURNEY, QUIZ_SECURITY, QA_RUNBOOK, updates to COMPLETION/ACCEPTANCE
- [ ] Pilot quiz content **proposal** committed to docs, NOT inserted
- [ ] Gates: typecheck / test / lint / build green
- [ ] Status set to `IMPLEMENTED_PENDING_RUNTIME_QA`; quiz NOT yet `SECURE_RENDERED_AND_RUNTIME_VALIDATED`

Approve to proceed, or tell me which sections to drop/reorder.
