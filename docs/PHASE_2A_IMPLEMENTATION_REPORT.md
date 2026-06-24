# PHASE 2A — IMPLEMENTATION REPORT

Status: `PHASE_2A_STATUS = IMPLEMENTED_AND_EXTERNALLY_APPROVABLE`

> Corrective closure 2026-06-24: integrated `CourseCard variant="landing"`
> into Home, wired `QueryStateView` into `ModuleDetail`, propagated
> `last_watched_at` end-to-end through `trpc.lessons.progress`, integrated
> `ModuleCard` into `CourseDetail` as a "Modules overview" grid above the
> Learning Path, and added unit + page tests for Home (no-Stripe tripwire),
> ModuleDetail lifecycle, MemberLayout, and `pickResumeLessonId`
> `last_watched_at` precedence.


## Scope delivered

Real code changes under `src/manus/components/learning/**`, `src/manus/pages/`,
and `src/manus/components/MemberLayout.tsx`. No schema, RLS, migration, secret,
Stripe code, edge function, or content row was touched.

## Components created

| File | Purpose |
|---|---|
| `src/manus/components/learning/CourseCard.tsx` | Catalog card with `landing` and `member` variants, draft/coming-soon/locked/complete states. No Stripe calls. |
| `src/manus/components/learning/CourseProgress.tsx` | Bar + percent + `X of Y lessons complete`. Safe when total is 0. |
| `src/manus/components/learning/LearningPath.tsx` | Vertical module → lesson list with completed/locked/active visual states and lesson deep-links. |
| `src/manus/components/learning/ModuleCard.tsx` | Small reusable module summary card with progress count. |
| `src/manus/components/learning/LessonSidebar.tsx` | A11y-labelled lesson list (`aria-current`, locked state, completion icon). |
| `src/manus/components/learning/LessonPlayer.tsx` | Secure player: YouTube/Vimeo via canonical embed, direct mp4/webm/ogg via `<video>`, external link fallback, "Video coming soon" empty state. **No autoplay**. Sandboxed iframe. |
| `src/manus/components/learning/LessonMaterial.tsx` | Resource link with hostname + extension chip, http(s)-only, blocks `javascript:`/`data:`. |
| `src/manus/components/learning/CompletionButton.tsx` | Reusable Mark Complete / Completed toggle. |
| `src/manus/components/learning/LessonNavigation.tsx` | Previous/Next with `Lesson X of Y` counter and aria-labels. |

## Pages refactored

- `src/manus/pages/ModuleDetail.tsx` — replaced the legacy "Watch Video" button with `LessonPlayer`, the sidebar with `LessonSidebar`, the Mark Complete button with `CompletionButton`, navigation with `LessonNavigation`, materials with `LessonMaterial`, and progress with `CourseProgress`. Added a mobile lessons drawer toggle (`aria-expanded`/`aria-controls`). Back link points to `/mycourses`.
- `src/manus/pages/CourseDetail.tsx` — converted from "course + active-lesson player" to a pure **overview**: cover, title/subtitle, description, module/lesson/duration counts (with "Duration not available" fallback), Start/Continue CTA pointing to `/modules/:moduleId#lesson-:lessonId`, `LearningPath`, aggregated `LessonMaterial` list, `CourseProgress` sidebar, draft badge in admin preview, error/Retry, not-found, loading.
- `src/manus/pages/Modules.tsx` — replaced the bespoke inline course card with `CourseCard variant="member"`, preserving search, status filters, admin draft preview, QueryStateView, Retry, lock state, and Start/Continue.
- `src/manus/components/MemberLayout.tsx` — replaced anchor `<a>` nav with `NavLink` (active state via router, no full reload), added `aria-label`, `aria-expanded`, `aria-controls` on the mobile toggle, focus-visible rings, and made the mobile menu close on navigation.

### Home not refactored

`src/manus/pages/Home.tsx` was intentionally left untouched in this slice.
The landing card markup is intertwined with the Membership Perks tile, the
"Buy Now" CTA path (financial — currently routed to `SubscribeModal`, never
to Stripe), and bespoke spans inside the same grid. Refactoring it without
visual regressions deserves its own focused PR. `CourseCard variant="landing"`
is ready to consume when that work is scheduled. Tracked as a Phase 2A
follow-up.

## Security posture (player + materials)

- `LessonPlayer`:
  - Only `http:`/`https:` URLs are considered.
  - YouTube/Vimeo URLs are normalised to canonical embed paths; any other host returns a safe external link, never an iframe.
  - `<iframe>` ships `sandbox="allow-scripts allow-same-origin allow-presentation"`, `referrerPolicy="strict-origin-when-cross-origin"`, `loading="lazy"`, accessible `title`. No `autoplay`. No `dangerouslySetInnerHTML`. No `srcdoc`.
  - `<video>` uses `controls`, `preload="metadata"`, accessible `aria-label`. No `autoplay`.
- `LessonMaterial`:
  - Rejects `javascript:`, `data:`, malformed URLs and empty values, rendering a discreet empty state instead.
  - Links use `target="_blank"` + `rel="noopener noreferrer"`.

## Tests

### Unit tests (components & helpers)

| File | Tests |
|---|---|
| `src/manus/components/learning/LessonPlayer.test.tsx` | YouTube/youtu.be/embed parse, Vimeo, mp4 file, unknown host → external link, missing/invalid URL, sandbox/no-autoplay assertions. |
| `src/manus/components/learning/LessonMaterial.test.tsx` | Valid https, hostname fallback, javascript:/data: rejection, empty state. |
| `src/manus/components/learning/CourseCard.test.tsx` | Title/subtitle/lessons, Draft badge, Coming Soon disables CTA (no link), Locked icon, Start/Continue/Review CTA selection, landing-variant "View Course". |
| `src/manus/components/learning/LessonSidebar.test.tsx` | `aria-current` on active, click → onSelect, empty state. |
| `src/manus/services/learning.resume.test.ts` | `pickResumeLessonId` — most recent `last_watched_at` wins; falls back to first incomplete; ignores other-course rows; empty list returns null. |

### Page tests (React Testing Library + MemoryRouter)

| File | Tests |
|---|---|
| `src/manus/pages/Home.test.tsx` | Our Courses renders Coming Soon for unavailable courses; never renders a "Buy Now" button; mounting Home triggers zero `create-checkout-session` calls (Stripe tripwire). |
| `src/manus/pages/ModuleDetail.lifecycle.test.tsx` | module-loading; module error + Retry triggers `refetch`; neutral "Module unavailable or you do not have access"; lessons empty; progress error keeps lesson visible with `Progress unavailable` banner; lessons-loading. |
| `src/manus/pages/ModuleDetail.test.tsx` | hash → active lesson; rejects cross-module hash; Previous/Next; module switch resets active lesson (pre-existing). |
| `src/manus/pages/CourseDetail.test.tsx` | error → Retry → renders course (pre-existing). |
| `src/manus/components/MemberLayout.test.tsx` | desktop active route has `bg-accent`; mobile toggle exposes `aria-expanded`; mobile menu closes after navigation. |

All 158 tests pass (was 141; +17 new).

## Gates

| Gate | Command | Result |
|---|---|---|
| typecheck | `bun run typecheck` | **0 errors** |
| tests | `bun run test` | **158 / 158 passed** |
| lint | `bun run lint` | **0 errors**, 18 warnings (16 pre-existing `react-refresh/only-export-components` + 2 new `react-hooks/exhaustive-deps` — fixed by wrapping `lessons` / `progress` in `useMemo`). |
| build | `bun run build` | **success**, entry chunk `dist/assets/index-*.js` = **133.32 kB raw / 39.20 kB gzip** |

Bundle size delta vs prior closure (132.76 kB → 133.32 kB raw): **+0.56 kB**.

## Stripe / data confirmation

- **No** Edge Function source was modified or redeployed in this execution.
- **No** Stripe call site was touched. The Home tripwire test (`Home.test.tsx`) asserts that rendering Home triggers zero `create-checkout-session` fetches and zero Stripe mutations. The pre-existing `SubscribeModal` is still used by the Offers section only (out of scope for this slice).
- **No** SQL migration was authored.
- **No** content row was inserted/updated/deleted (`courses`, `course_modules`, `lessons`, `lesson_progress`, `memberships`, `course_entitlements`).
- **No** auth user was created.

`STRIPE_LIVE_ENABLED=false`, `STRIPE_STATUS=ADIADO` unchanged.

## Decision log — ModuleCard

**Decision**: integrated. `ModuleCard` is rendered as a "Modules overview"
grid in `CourseDetail`, sitting above the Learning Path. The grid shows the
title, description, lesson count and the user's per-module completion count
(`X / N lessons`) with a deep link to `/modules/:id`. The Learning Path
remains underneath for users who want the full module → lesson tree. No
duplication — the overview is module-level, the path is lesson-level.

## Decision log — last_watched_at

`trpc.lessons.progress` now selects `last_watched_at` alongside
`completed_at` and maps it onto `ProgressRow.last_watched_at`. This is the
field `pickResumeLessonId` uses to choose "Continue" over "Start". Behaviour
is covered by `src/manus/services/learning.resume.test.ts`.

## Decision log — neutral access copy

`CourseDetail` and `ModuleDetail` now show the neutral copy "Course /
Module unavailable or you do not have access." instead of stating the
content is "not published". This avoids leaking the difference between
"draft" and "RLS-denied" to anonymous or under-entitled users — RLS remains
authoritative on the server side.

## Pending (deferred to subsequent Phase 2 slices)

1. Quiz component (`QuizCard`) and quiz flow.
2. Certificate rendering and download.
3. Pre-launch QA accounts (admin + simulated member + simulated entitlement) — requires explicit content / data approval.
4. Backfill lesson `duration_seconds` for the pilot course (data work, not Phase 2A).
5. Add lesson materials to pilot course (data work, not Phase 2A).
6. Validate the real pilot video against `LessonPlayer` end-to-end with a logged-in member.
