# Phase 2 — Runtime QA Runbook (DO NOT EXECUTE YET)

To be run on the hosted preview after:
- Migration `20260625000000_secure_quiz_options_and_module_ratings.sql` applied.
- Pilot quiz approved and published.

## Accounts to create (manually, via Supabase dashboard)

| Handle             | Setup                                                                  |
|--------------------|------------------------------------------------------------------------|
| `qa-no-access`     | Create user. No membership, no entitlement.                            |
| `qa-member`        | Create user. Insert `memberships` row, `status='active'`, future `ends_at`. |
| `qa-entitlement`   | Create user. Insert `course_entitlements` for course 1, `active=true`, future `ends_at`. |

Document the email/password pair in a sealed credentials store — NOT in this
repo.

## Test matrix (each persona, mobile 390px + desktop 1440px)

### qa-no-access
- [ ] Login redirects to `/plans` (not to `/dashboard`).
- [ ] Visiting `/courses/1` shows neutral "Course unavailable or you do not have access".
- [ ] Visiting `/modules/X` shows "Module unavailable or you do not have access".
- [ ] Direct POST to `/functions/v1/submit-quiz-attempt` → `403 forbidden`.

### qa-member
- [ ] Login redirects to `/dashboard`.
- [ ] `/courses/1` renders hero + modules + Course Quiz.
- [ ] Opens `/modules/X`, plays video, marks lesson complete, progress persists across reload.
- [ ] Submits course quiz with all correct → `passed=true`, score 100, score row appears in `quiz_attempts`.
- [ ] Submits with one wrong → score reflects deduction; `passed` matches passing_score.
- [ ] Network tab: no request reads `quiz_options.is_correct`.
- [ ] Submits past `max_attempts` → UI shows "no attempts remaining".
- [ ] Rates module 4★ → average + count update on reload.

### qa-entitlement
- [ ] Login redirects to `/mycourses` showing only course 1.
- [ ] `/courses/2` (a course they do not own) shows neutral access message.
- [ ] Same quiz/rating flow as member for course 1.

### admin (`contact@casaalchemystudio.com`)
- [ ] Sees draft courses and draft quizzes via admin preview banner.
- [ ] QuizCard admin preview renders correct-answer reveal locally and does **not**
      insert into `quiz_attempts` (verify table count unchanged).
- [ ] Can manage quiz from `/admin/courses/:id`.

## Console / network gates

- `console fatal errors == 0`
- `Stripe calls == 0`
- No 4xx/5xx other than the expected `403/409` on the negative cases above.

## Sign-off

When every box above is checked on the hosted preview, update
`docs/PHASE_2_COMPLETION_REPORT.md`:

```
STUDENT_JOURNEY_STATUS = VALIDATED_FOR_LAUNCH
QUIZ_STATUS = SECURE_RENDERED_AND_RUNTIME_VALIDATED
```

Sign with date, hosted preview URL, and tester handle.
