# PRELAUNCH BASELINE — Alchemy Academy

> Phase 0 baseline lock. Read-only inventory of the platform at the moment the
> `prelaunch/phase-0-1-hardening` work starts. No code, schema, data, Stripe,
> domain, or pilot-quiz changes are made by this document.

## 1. Identification

| Field | Value |
|---|---|
| GitHub repository | `Alchemyacademy-design/alchemy-academy-preview` |
| Working branch | `prelaunch/phase-0-1-hardening` |
| Protected branch | `main` (no direct writes during this phase) |
| Commit-base (SHA initial) | `bb54dbef25d5d47a21f3474309ea68cb16dee1c3` |
| Lovable project | `aa3b388c-6623-43ee-8740-326108415543` |
| Supabase project ref | `omzwtfnqffseemrlylwu` |
| Designated admin | `contact@casaalchemystudio.com` (role `admin`, protected by trigger `protect_designated_admin`) |
| Stripe | `STRIPE_LIVE_ENABLED=false`, `STRIPE_STATUS=ADIADO` |

## 2. Routes inventory

Source of truth: `src/App.tsx`. Every `<Route>` declared there is listed below.

### Public
- `/` (Home)
- `/plans`
- `/login`
- `/signup`
- `/reset-password`
- `/forgot-password` (alias → `ResetPassword`)
- `/auth/callback`
- `/auth/update-password`
- `/auth/continue` (`PostAuthRedirect`)
- `/activate`
- `/courses` (`Guides` — public catalogue)
- `/courses/:id` (gating evaluated inside the page)
- `/404`
- `*` (catch-all → `NotFound`)

### Authenticated (member-facing)
- `/dashboard` (membership-only)
- `/mycourses` (`Modules`)
- `/mycourses/:id` (`ModuleDetail`)
- `/modules` (redirect → `/mycourses`)
- `/modules/:id` (`ModuleDetail`)
- `/profile`
- `/community`, `/suppliers`, `/events`, `/magazine`, `/live-workshops` (membership-only)
- `/payment/success`, `/payment/cancel`

### Admin (gated by `<AdminGuard>` → `useAuth().isAdmin` → `has_role(auth.uid(),'admin')`)
- `/admin`
- `/admin/analytics`
- `/admin/courses`
- `/admin/courses/new`
- `/admin/courses/:id`
- `/admin/content-import` (redirect → `/admin/courses`)
- `/admin/import` (redirect → `/admin/courses`)
- `/admin/lessons` (`AdminLessonsBulk`)
- `/admin/students`
- `/admin/diagnostics`
- `/admin/events`
- `/admin/workshops`
- `/admin/magazine`
- `/admin/suppliers`
- `/admin/supplier-categories`
- `/admin/deals`
- `/admin/plans`
- `/admin/certificates`
- `/admin/users/:id`
- `/admin/phase-2-preview` (redirect → `/admin/courses`)

## 3. Critical tables (Supabase `public` schema)

`profiles`, `user_roles`, `courses`, `course_modules`, `lessons`,
`lesson_progress`, `memberships`, `course_entitlements`, `quizzes`,
`quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`,
`certificates`, `membership_plans`, `plan_permissions`,
`stripe_customers`, `stripe_subscriptions`, `stripe_prices`, `stripe_products`,
`stripe_payments`, `stripe_checkout_sessions`, `stripe_webhook_events`,
`community_*`, `events`, `live_workshops`, `magazine_issues`, `exclusive_deals`,
`suppliers`, `supplier_categories`, `supplier_favorites`, `registrations`,
`moderation_actions`, `integration_secret_requirements`, `checkout_rate_limits`.

Missing (to be created by the secure-quiz migration, NOT in this phase):
`module_ratings`.

## 4. Edge Functions

| Function | Purpose | Notes |
|---|---|---|
| `auth-me` | Session info | active |
| `admin-bootstrap` | Initial admin seed | active |
| `admin-audit` | Admin actions audit log | active |
| `admin-content-catalog` | Admin catalog list | active |
| `admin-manage-stripe-subscription` | Admin Stripe ops | deferred-safe, no live writes |
| `admin-manage-user-access` | Grant entitlements | active |
| `billing-config-status` | Billing readiness probe | active |
| `create-checkout-session` | Stripe checkout | gated by `STRIPE_LIVE_ENABLED` |
| `stripe-webhook` | Stripe event ingestion | gated by `STRIPE_LIVE_ENABLED` |
| `recover-stripe-events` | Webhook replay | manual ops |
| `lesson-video-url` | Signed lesson URL | active |
| `manus-import` | Content import | admin-only |
| `get-member-quiz` | Member-safe quiz fetch (no `is_correct`) | **deployed; depends on revoked SELECT on `quiz_options`** |
| `get-admin-quiz` | Admin quiz fetch (with `is_correct`) | **deployed** |
| `submit-quiz-attempt` | Transactional grading wrapper | **deployed; depends on missing RPC `internal_submit_quiz_attempt`** |

## 5. Required environment variables / secrets

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DB_URL`, `SUPABASE_JWKS`, `LOVABLE_API_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_LIVE_ENABLED=false`, `STRIPE_EXPECTED_LIVEMODE=true`.

Frontend `.env` is auto-populated with `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

## 6. Subsystem state at baseline

| Subsystem | Status |
|---|---|
| Stripe | `ADIADO` — `STRIPE_LIVE_ENABLED=false`. No live charges. `LIVE_VALIDATED=false`. |
| Quiz security (frontend + edge) | Implemented: member never reads `is_correct`; both edge functions deployed. |
| Quiz security (database) | **BLOCKED** — `REVOKE SELECT ON quiz_options` and RPC `internal_submit_quiz_attempt` not yet applied. |
| Quiz runtime | `BLOCKED_BY_MISSING_RPC`. |
| Rating | `BLOCKED_BY_MISSING_DATABASE_OBJECTS` (no `module_ratings`, `module_rating_summary`, `can_access_module`). |
| Certificates | Course-scoped completion implemented; pending runtime QA. |
| CI | Workflow `.github/workflows/ci.yml` exists (typecheck → test → lint → build). GitHub run not yet observed for this branch. |

## 7. Rollback plan

### Frontend
- Revert the working branch with `git revert` of the merge commit, or close
  the PR without merging. No frontend change in this phase requires a data
  rollback.
- Lovable version history can restore any prior snapshot.

### Database
- The migration `secure_quiz_and_module_ratings` is **not yet applied**.
- Rollback script (documented inside the migration file):
  ```sql
  DROP FUNCTION IF EXISTS public.module_rating_summary(bigint);
  DROP FUNCTION IF EXISTS public.can_access_module(uuid, bigint);
  DROP TRIGGER  IF EXISTS module_ratings_set_updated_at ON public.module_ratings;
  DROP FUNCTION IF EXISTS public.touch_module_ratings_updated_at();
  DROP TABLE    IF EXISTS public.module_ratings;
  DROP FUNCTION IF EXISTS public.internal_submit_quiz_attempt(uuid, bigint, jsonb);
  -- Only if a downgrade explicitly requires it (NOT recommended — re-exposes answer key):
  -- GRANT SELECT ON public.quiz_options TO authenticated, anon;
  ```
- No data is modified or removed by the migration. Rollback is purely DDL.

## 8. Status flags

```
BASELINE_STATUS=LOCKED
CI_STATUS=CONFIGURED_PENDING_REMOTE_RUN
QUIZ_RUNTIME_STATUS=BLOCKED_BY_MISSING_RPC
RATING_RUNTIME_STATUS=BLOCKED_BY_MISSING_DATABASE_OBJECTS
STRIPE_STATUS=ADIADO
```

## 9. Forbidden in this phase

No visual work, no pilot quiz publication, no QA student creation, no Stripe
activation, no domain change, no Preview Lab, no destructive data ops, no
status changes to courses/modules/lessons/quizzes/users/memberships/entitlements,
no direct writes to `main`.
