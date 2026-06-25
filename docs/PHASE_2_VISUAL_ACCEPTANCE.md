# Phase 2 — Visual Acceptance

**Commit:** `7e7a088fb69b36fbb614d20456705a09471f6503`
**Scope:** Hotfix funcional e visual da Fase 2 — rotas reais e player de vídeo.

## Status

| Item | Status |
| --- | --- |
| PHASE_2_RENDERING_STATUS | `RENDERED_ON_REAL_ROUTES` |
| VIDEO_PLAYER_STATUS | `IMPLEMENTED_PENDING_HOSTED_VALIDATION` |
| ADMIN_DRAFT_VISIBILITY | `IMPLEMENTED_PENDING_HOSTED_VALIDATION` |
| HOSTED_PREVIEW_STATUS | `PENDING_DEPLOY` (sandbox only) |

> The final `*_VALIDATED` statuses are intentionally **not** declared.
> They depend on the hosted preview being republished with this commit
> and exercised in an anonymous and an authenticated session.

## Real routes covered

All previewing happens on production routes — there is **no Preview
Lab**, **no demo route**, **no `/admin/phase-2-preview`**, **no fixture
output**. Any historical reference to those has been removed.

| Route | Purpose |
| --- | --- |
| `/` | Home / Our Courses (admin sees drafts with badge) |
| `/mycourses` | Member catalogue |
| `/courses/:id` | Course overview |
| `/modules/:id` | Lesson player + sidebar + navigation |
| `/dashboard` | Member dashboard |

## Video player — Dropbox + standard providers

Implementation:

- `src/manus/lib/video-url.ts` — single source of truth.
  - Exports `parseVideoUrl`, `normalizeVideoUrl`, `getVideoProvider`.
  - Supports YouTube, Vimeo, Dropbox, MP4, WebM, OGG/OGV, MOV, and
    unknown external URLs.
  - Dropbox normalisation: detects `dropbox.com`, `www.dropbox.com`,
    `dl.dropboxusercontent.com`, including `/scl/fi/…` URLs; strips the
    `dl` parameter, forces `raw=1`, preserves `rlkey` and other params,
    and is **only** applied at render time (DB rows are not mutated).
- `src/manus/components/learning/LessonPlayer.tsx` — uses the parser,
  exposes `loading` (via `onLoadedMetadata` / `onCanPlay`) and
  `errored` (via iframe / `<video>` `onError`) states.
  - On error, shows: *“Unable to play this video.”* + **Retry** +
    **Open externally** + (admin-only) *“Confirm that the shared link
    allows public viewing.”*
  - Admins additionally see a discreet diagnostics line: provider,
    player type, and the normalised URL with query string stripped.
- `src/manus/components/admin/VideoPreview.tsx` — uses the same parser,
  so the admin preview and the student player are identical.

Player unit tests (17 in `video-url.test.ts` + 15 in
`LessonPlayer.test.tsx`):

- Dropbox `dl=0 → raw=1`
- Dropbox `dl=1 → raw=1`
- Dropbox `raw=1` stays valid
- Dropbox `.mp4` classified as `file`
- `dl.dropboxusercontent.com` is normalised
- Non-Dropbox URLs are not mutated
- YouTube watch / youtu.be / embed
- Vimeo numeric / `player.vimeo.com`
- Direct MP4 / WebM / OGG
- `javascript:` and `data:` blocked
- Invalid / null / empty → `none`
- External links use `target="_blank" rel="noopener noreferrer"`

## Admin draft visibility on real routes

- New hook `useHomeCourses({ includeDrafts })`
  (`src/manus/hooks/usePublicContent.ts`). When `includeDrafts=true` it
  returns non-archived courses regardless of status; when `false` it
  returns only `status='published'`. RLS remains the security
  authority — non-admins never see drafts.
- `Home.tsx` reads `isAdmin` from `useAuth()` and calls
  `useHomeCourses({ includeDrafts: isAdmin })`. Drafts render with both
  an **Admin Preview** and a **Draft** badge on the landing card, and
  the card is linked to `/courses/:id`. No status change is performed.
- `usePublishedCourses` was left intact for visitor surfaces and now
  additionally enforces `archived_at IS NULL` as defence-in-depth.

## Visual fixes

### CourseCard

`src/manus/components/learning/CourseCard.tsx`:

- `landing` and `member` variants no longer share padding / radius:
  - **landing:** `rounded-none`, single inner `p-7` (28px total,
    no double padding), hover shadow
    `0 12px 40px rgba(0,0,0,0.18)`, `translateY(-3px)`.
  - **member:** `rounded-md`, `p-6` inner padding, smaller hover
    shadow, retains Start / Continue / Review CTA.
- Adds **Admin Preview** badge slot (amber) before the Draft badge.
- Overlay tokens unchanged (40% base / 50% hover from prior fix).
- Card body inherits `font-family: Manrope`.

### Membership Perks card

- Removed inline `gridColumn: "span 4"`.
- Applied responsive Tailwind utilities: `col-span-1 sm:col-span-2
  lg:col-span-3 xl:col-span-4`.
- Inner perks list switched from `grid-cols-2` to
  `grid-cols-1 sm:grid-cols-2` so mobile stacks into a single column
  with no horizontal scroll.

### Typography

- `Our Courses` section paragraph and the “catalogue could not load”
  banner switched from DM Sans to Manrope.
- CourseCard now sets `font-family: Manrope` at the article level.
- Pricing / Offers tables intentionally untouched (outside the
  Courses surfaces).

## Gates

| Gate | Result |
| --- | --- |
| `bun run typecheck` | ✅ 0 errors |
| `bun run lint` | ✅ 0 errors (17 unrelated `react-refresh` warnings) |
| `bun run test` | ✅ 189 / 189 across 26 files |
| `bun run build` | ✅ entry `index` = 137.30 kB (gzip 40.50 kB) |
| Stripe calls during Home render | ✅ 0 (tripwire test) |
| Public draft leakage (non-admin path) | ✅ 0 (hook filtered by status) |

## Pending for hosted validation

The following items can only be marked as `VALIDATED` after the new
commit is published to the hosted preview and exercised manually:

1. Hosted commit equals `7e7a088…` on the published URL.
2. Admin opens `/`, `/mycourses`, `/courses/1`, `/modules/1`,
   `/dashboard` and sees the draft course / module / lesson with the
   Admin Preview badge.
3. Lesson 1’s Dropbox link plays (play / pause / seek / fullscreen /
   direct reload).
4. Console shows: 0 fatal errors, 0 media errors, 0 chunk 404s,
   0 Stripe calls.
5. Visitor (anonymous) session does **not** see the draft course on
   `/`, and `/courses/1` / `/modules/1` do not expose draft content.
6. Screenshots captured at 390 px and 1440 px for `/`, `/mycourses`,
   `/courses/1`, `/modules/1` and saved under
   `docs/screenshots/phase-2/`.

If the Dropbox video fails to play on the hosted preview after these
steps, declare `VIDEO_PLAYER_STATUS = NOT_RESOLVED` and do not mark
the phase as visually validated.

## Removed (no longer in scope)

- `AdminPhase2Preview` page — removed in a previous turn.
- `/admin/phase-2-preview` route — removed.
- Preview Lab admin menu item — removed.
- Preview Lab fixtures — removed.
- This document no longer references any of the above.
