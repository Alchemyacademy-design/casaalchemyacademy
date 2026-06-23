# PHASE 2A — IMPLEMENTATION REPORT

Status: `PHASE_2A_STATUS = IMPLEMENTED_PENDING_EXTERNAL_AUDIT`

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

New test files (4 files, 34 tests):

| File | Tests |
|---|---|
| `src/manus/components/learning/LessonPlayer.test.tsx` | YouTube/youtu.be/embed parse, Vimeo, mp4 file, unknown host → external link, missing/invalid URL, sandbox/no-autoplay assertions. |
| `src/manus/components/learning/LessonMaterial.test.tsx` | Valid https, hostname fallback, javascript:/data: rejection, empty state. |
| `src/manus/components/learning/CourseCard.test.tsx` | Title/subtitle/lessons, Draft badge, Coming Soon disables CTA (no link), Locked icon, Start/Continue/Review CTA selection, landing-variant "View Course". |
| `src/manus/components/learning/LessonSidebar.test.tsx` | `aria-current` on active, click → onSelect, empty state. |

All previously-existing tests continue to pass.

## Gates

| Gate | Command | Result |
|---|---|---|
| typecheck | `bun run typecheck` | **0 errors** |
| tests | `bun run test` | **141 / 141 passed** (was 107; +34 new) |
| lint | `bun run lint` | **0 errors**, 16 unchanged warnings (`react-refresh/only-export-components`) |
| build | `bun run build` | **success**, entry chunk `dist/assets/index-*.js` = **132.76 kB raw / 38.71 kB gzip** |

Bundle size delta vs Phase 1 closure (132.66 kB → 132.76 kB raw): **+0.10 kB**.

## Stripe / data confirmation

- **No** Edge Function source was modified or redeployed in this execution.
- **No** Stripe call site was touched. Financial CTAs continue to use the existing pre-launch `SubscribeModal` path (no `create-checkout-session` calls).
- **No** SQL migration was authored.
- **No** content row was inserted/updated/deleted (`courses`, `course_modules`, `lessons`, `lesson_progress`, `memberships`, `course_entitlements`).
- **No** auth user was created.

`STRIPE_LIVE_ENABLED=false`, `STRIPE_STATUS=ADIADO` unchanged.

## Pending (deferred to subsequent Phase 2 slices)

1. Extract Home's landing card grid to `CourseCard variant="landing"` without visual regression.
2. Quiz component (`QuizCard`) and quiz flow.
3. Certificate rendering and download.
4. Pre-launch QA accounts (admin + simulated member + simulated entitlement) — requires explicit content / data approval.
5. Backfill lesson `duration_seconds` for the pilot course (data work, not Phase 2A).
6. Add lesson materials to pilot course (data work, not Phase 2A).
