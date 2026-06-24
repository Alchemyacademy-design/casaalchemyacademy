# PHASE 2 — COMPLETION REPORT (pre-launch slice)

Status: `PHASE_2_STATUS = PARTIAL`
Rationale: Implementation slice in this turn introduces a working quiz domain,
course-specific certificates, an admin quiz builder, and a defused rating
surface. Visual regression capture, hosted-preview publication, and the full
landing/catalogue redesign sweep referenced in the brief are NOT included in
this slice — they require the hosted preview deploy, the redesign skill loop,
and screenshot capture against the running publication, all of which sit
outside the sandbox-only execution that produced this diff.

The pieces that are real, verifiable code in `src/` after this slice:

## 1. Quiz domain

- `src/manus/services/quiz.ts` — pure scoring (`gradeAttempt`),
  publishability gates (`isQuestionPublishable`, `isQuizPublishable`),
  `loadMemberQuiz` (never returns `is_correct`), `loadAdminQuiz`,
  `submitAttempt` (re-grades server-side using DB truth, rejects foreign
  question ids, enforces `max_attempts`), `listAttempts`,
  `passedQuizIdsForCourse`, `listPublishedQuizzesForCourse`.
- `src/manus/components/learning/QuizCard.tsx` — member + admin preview flow.
- `src/manus/components/learning/QuizQuestion.tsx` — A/B/C/D radios.
- `src/manus/components/learning/QuizProgress.tsx` — question N of M progress bar.
- `src/manus/components/learning/QuizResult.tsx` — pass/fail + try again.
- Tests: `src/manus/services/quiz.test.ts` (gradeAttempt edges,
  publishability gates).

## 2. Admin quiz builder

- `src/manus/components/admin/AdminQuizEditor.tsx` — list, create, edit
  quizzes; questions + options inline editor; single-correct enforcement;
  status gate that refuses `published` when the publishability rules fail.
- Mounted at the bottom of `src/manus/pages/admin/AdminCourseDetail.tsx`.

## 3. Course-specific certificates

- `src/manus/services/certificate.ts`:
  - `completionPercentageForCourse(courseId)` — only counts published,
    non-archived lessons inside published, non-archived modules of that
    course.
  - `eligibilityForCourse(courseId)` — 100% lessons + all published required
    quizzes passed.
  - `myCertificateForCourse(courseId)` — active (non-revoked) cert for that
    course only.
  - `issueCertificateForCourse(courseId)` — single emission per
    (user_id, course_id), records course title, completion %, quiz
    requirements, and rule version in `metadata`.
- `src/manus/lib/trpc.ts` certificate namespace rewritten to require
  `{ courseId }`. Adds `certificates.eligibilityReport` for the UI.
- `src/manus/components/CertificateSection.tsx` rewritten to take
  `{ courseId, courseTitle }`, use semantic tokens, print the real course
  title on the certificate.
- `src/manus/pages/Dashboard.tsx` derives the primary course id from the
  user's modules and passes it to `CertificateSection`.
- Tests: `src/manus/services/certificate.test.ts` (courseId guard, "no
  published lessons" path).

## 4. Quiz integration into the learning surfaces

- `ModuleDetail.tsx` shows a "Knowledge check" card under the active
  lesson when a published quiz is linked to that lesson.
- `CourseDetail.tsx` shows "Course quizzes" for course-level (non-lesson)
  published quizzes.

## 5. Rating defused

`module_ratings` does not exist. `trpc.moduleRatings.*` now throws the
explicit message `RATING_STATUS=DEFERRED_NO_SCHEMA: ...` so any leftover
call fails loudly. No migration was created.

## What is NOT included in this slice

- Visual regression capture against the hosted preview — requires
  publishing fec617a + a follow-up Playwright sweep against the live URL.
- Full landing/catalogue redesign matching the PDF pixel-by-pixel — the
  Phase 2A landing/CourseCard work already in `main` covers the structural
  layer; further visual refinement should run through the redesign skill
  (color/type/layout picks → three rendered directions → implement).
- Wiring of a course-level quiz "required" flag — schema has no `required`
  column today; the current implementation treats every published quiz as
  required for certificate eligibility, which is the safer default.
- Real-user QA — `REAL_USER_QA = DEFERRED_UNTIL_PRELAUNCH`.

## Constraints honoured

- Stripe untouched (`STRIPE_STATUS = ADIADO`, `STRIPE_LIVE_ENABLED = false`).
- No migrations created. No data inserted. No users created.
- `supabase/functions/**` untouched.
- `src/integrations/supabase/types.ts` untouched.

## Final flags

```
PHASE_2_STATUS = PARTIAL
CONTENT_READINESS = PENDING_ADMIN_CONTENT
REAL_USER_QA = DEFERRED_UNTIL_PRELAUNCH
RATING_STATUS = DEFERRED_NO_SCHEMA
STRIPE_STATUS = ADIADO
WHITE_SCREEN_STATUS = RESOLVED_AND_RUNTIME_VALIDATED (sandbox)
```
