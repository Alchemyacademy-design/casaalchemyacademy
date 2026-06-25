# Phase 2 — Student Journey

`STUDENT_JOURNEY_STATUS = IMPLEMENTED_PENDING_RUNTIME_QA`

## Access model (unchanged in code; documented here)

- `SIGNUP_STATUS = AUTHENTICATED_NO_COURSE_ACCESS` — signup never grants
  course access.
- `STUDENT_ACCESS_REQUIRES = ACTIVE_MEMBERSHIP_OR_ACTIVE_COURSE_ENTITLEMENT`.
- `admin` role: full access to everything (designated admin protected by trigger).
- No access → routed to `/plans` (except `/profile`, `/payment/*`, `/courses` previews).

Implementation: `src/manus/components/GlobalAccessController.tsx`.

## Route map (real routes, not preview lab)

| Route                | Renders                                                                        |
|----------------------|--------------------------------------------------------------------------------|
| `/courses/:id`       | Hero, About, modules overview, Learning path, Materials, course Quiz, sidebar  |
| `/modules/:id`       | LessonSidebar, video player, content, materials, lesson Quiz, **ModuleRating**, Previous/Lesson X of Y/Next |
| `/dashboard`         | Member-only catalog                                                            |
| `/mycourses`         | Entitlement-only catalog                                                       |
| `/plans`             | Pricing surface for no-access users                                            |

## Components added/changed this pass

- `src/manus/components/learning/ModuleRating.tsx` — new; 5 stars + average +
  count + own rating, loading/error/Retry/empty, write disabled in admin preview.
- `src/manus/services/quiz.ts` — `submitAttempt` now posts to the
  `submit-quiz-attempt` edge function (no client-side grading for members).
- `src/manus/pages/ModuleDetail.tsx` — renders `ModuleRating` after the quiz
  section.

## What this pass does NOT do

- Does not create qa-member / qa-entitlement / qa-no-access users.
- Does not seed pilot quiz content (see `docs/PHASE_2_PILOT_QUIZ_PROPOSAL.md`).
- Does not flip Stripe to live.
- Does not promote the Quiz status to `SECURE_RENDERED_AND_RUNTIME_VALIDATED`
  — that requires the runtime QA pass.

## Pending external steps (in order)

1. Apply migration `docs/migrations/20260625000000_secure_quiz_options_and_module_ratings.sql`.
2. Approve pilot quiz content → insert as `draft`.
3. Promote pilot quiz to `published`.
4. Create the three QA accounts following `docs/PHASE_2_QA_RUNBOOK.md`.
5. Execute the QA runbook on the hosted preview.
6. Promote statuses to `VALIDATED_FOR_LAUNCH` and
   `SECURE_RENDERED_AND_RUNTIME_VALIDATED`.
