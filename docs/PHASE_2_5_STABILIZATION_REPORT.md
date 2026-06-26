# Phase 2.5 — Stabilization & Browser QA Report (PR #2)

> Status: **COMPLETE — AWAITING_EXTERNAL_AUDIT**
> No merge. No DB changes. No Stripe changes. No `main` writes.

---

## Branch / HEAD

| Field | Value |
|-------|-------|
| Working branch | `prelaunch-phase-2-3-official-render` (workspace edit-branch `edit/edt-8a90cab1-…` derived from it) |
| Starting HEAD | `4c0aefc9ade8051966bd03769a0644af312b76a6` |
| Final HEAD (pre-commit; updated by Lovable on push) | _set by GitHub on PR sync_ |
| Base | `main` (`19a28d8a547c06088fbeb827180dbbebe0f2009d`) |
| PR | #2 — Official render (DRAFT, **NOT MERGED**) |

`git branch --show-current` + `git rev-parse HEAD` were executed before the first edit.
Starting HEAD matched the expected SHA `4c0aefc9…`.

---

## Files Audited

- `src/manus/components/MemberLayout.tsx`
- `src/manus/components/learning/CourseCard.tsx`
- `src/manus/components/member/MemberUI.tsx`
- `src/manus/pages/Dashboard.tsx`
- `src/manus/pages/Modules.tsx`
- `src/manus/pages/CourseDetail.tsx`
- `src/manus/styles/official-render.css`
- `tailwind.config.ts`

## Files Changed (this batch)

| File | Change |
|------|--------|
| `src/manus/components/learning/CourseCard.tsx` | Locked card now links to fallback `href` (e.g. `/plans`) with "View plans" CTA. Without `href`, still falls back to disabled "Available soon". |
| `src/manus/pages/CourseDetail.tsx` | When `accessible === false`: hides "Modules overview" (which would link to private modules), hides quizzes, and filters materials to lessons with `is_preview === true` only. `startHref` now requires `accessible`. |
| `src/manus/styles/official-render.css` | Added `.aa-mobile-menu` overrides for `aa-member-nav-link` and `aa-member-nav-label` to use `--foreground` / `--muted-foreground` tokens (the desktop sidebar tokens are designed for the dark sidebar; they were invisible on the light mobile menu background). |
| `src/manus/components/learning/CourseCard.test.tsx` | Strengthened locked test to assert the `/plans` link with "View plans" name; added a no-href locked test that asserts a disabled "Available soon" button and no `<a>`. |

No other files were touched. No DB schema, RLS, edge function, or Stripe code modified.

---

## Mandatory Corrections — Status

### 1. Mobile contrast (`MOBILE_CONTRAST`)
**Fixed.** The mobile menu inherited `aa-member-nav-link { color: hsl(var(--sidebar-foreground) / 0.7) }`. Because `--sidebar-foreground` is tuned for the dark desktop sidebar (light cream text), it had ~1.3:1 contrast against the light `--background` of the mobile sheet.
The fix adds scoped overrides under `.aa-mobile-menu` only — desktop sidebar is untouched.

### 2. Global tokens regression (`GLOBAL_TOKEN_REGRESSION`)
**No regression.** `tailwind.config.ts` still exposes `gold`, `gold-light`, `olive`, `olive-mid`, `olive-light`, `cream`, `cream-dark`. `src/index.css` still defines `--aa-gold`, `--aa-olive-*`, `--aa-cream*` CSS variables and the `.btn-gold` utility (used by `MemberLayout` "Sign in" CTA and across legacy public pages — Home, Auth, etc.). Nothing in this batch removed or renamed those tokens.
`rg '\b(gold|olive|cream|btn-gold)\b'` returns 250 occurrences across legacy public pages, all still resolvable.

### 3. Locked course security (`LOCKED_COURSE_SECURITY`)
**Hardened.** In `CourseDetail.tsx` when `accessible === false`:
- `startHref` is `null` → "View membership" CTA only (no link into private modules).
- Modules overview grid is suppressed (it would have linked to `/modules/:id` for every module, including private ones).
- Course quizzes section is suppressed.
- Materials are filtered to lessons with `is_preview === true` only (was previously showing materials from every published lesson).
- `LearningPath` already received `locked: !accessible && !lesson.is_preview` per lesson, and the component already renders locked entries as non-link spans — confirmed during audit, no code change needed there.
- RLS in Supabase remains the final line of defense.

### 4. CourseCard audit
- No nested `<a>` — the outer `<Link>` wraps the article; internal CTAs are spans, not links.
- Locked → `View plans` link to `href` (typically `/plans`).
- Draft badge: rendered when `published === false` (caller passes `published: !draft` and `adminPreview: isAdmin && draft` — student users never see drafts because `Modules.tsx` only fetches published rows; admins see them with the explicit "Admin Preview" badge).
- States verified by tests: not-started (`Start`), in-progress (`Continue`), completed (`Review`), locked (`View plans`), coming-soon (no link).
- Keyboard focus: outer `<Link>` has `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl`.

### 5. MemberLayout audit
- Admin Center link only renders when `isAdmin` (both desktop sidebar and mobile menu).
- Logout button present in both shells.
- Mobile toggle exposes `aria-expanded`, `aria-controls="member-mobile-menu"`, and `aria-label` toggling between "Open"/"Close navigation menu".
- Mobile menu items close the sheet on click (existing test covers it).
- Sidebar uses `sticky top-0 h-screen` and `overflow-hidden` on the aside with `overflow-y: auto` on the nav — long profile content scrolls within the nav, profile pinned to bottom.
- Existing test suite (`MemberLayout.test.tsx`) already covers desktop active state, aria-expanded toggle, and close-on-navigate.

---

## CI Local

| Step | Result |
|------|--------|
| `bun install --frozen-lockfile` | OK (cached) |
| `bun run typecheck` | **PASS** (0 errors) |
| `bun run test` | **PASS — 201/201** across 29 test files (was 200 baseline; +1 new locked-no-href test, +1 strengthened locked-with-href test replacing the smoke test) |
| `bun run lint` | **PASS** (0 errors, 17 pre-existing warnings — all `react-refresh/only-export-components`, unchanged by this batch) |
| `bun run build` | **PASS** (vite build in ~9s) |

---

## Browser QA (Playwright, headless Chromium)

### PUBLIC_BROWSER_QA

Captured for every viewport × route in the matrix. All member routes correctly redirect unauthenticated visitors to `/login`. No console errors, no horizontal overflow.

| Viewport | Route | Final URL | H-overflow | Console errors |
|----------|-------|-----------|------------|----------------|
| 390×844 (mobile) | `/dashboard` | `/login` | 0 px | none |
| 390×844 | `/mycourses` | `/login` | 0 px | none |
| 390×844 | `/courses/1` | `/login` | 0 px | none |
| 768×1024 (tablet) | `/dashboard` | `/login` | 0 px | none |
| 768×1024 | `/mycourses` | `/login` | 0 px | none |
| 768×1024 | `/courses/1` | `/login` | 0 px | none |
| 1024×768 (tablet-L) | `/dashboard` | `/login` | 0 px | none |
| 1024×768 | `/mycourses` | `/login` | 0 px | none |
| 1024×768 | `/courses/1` | `/login` | 0 px | none |
| 1440×900 (desktop) | `/dashboard` | `/login` | 0 px | none |
| 1440×900 | `/mycourses` | `/login` | 0 px | none |
| 1440×900 | `/courses/1` | `/login` | 0 px | none |

Direct refresh on each URL was implicitly exercised (each route is a cold `page.goto`).

**Screenshots:** `/tmp/browser/p25/screens/{mobile,tablet,tabletL,desktop}-{dashboard,mycourses,course1}.png` (12 files).
**Report JSON:** `/tmp/browser/p25/report.json`.

### AUTHENTICATED_BROWSER_QA

**NOT EXECUTED — RUNNER LIMITATION.**

`LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged`. The project uses an external/BYO Supabase that Lovable cannot mint a sandbox session for. No `LOVABLE_BROWSER_SUPABASE_SESSION_JSON` is available, and providing real credentials in the runner would be a security violation. Therefore:

- Authenticated render of `/dashboard`, `/mycourses`, `/courses/:id` (as student vs admin)
- Mobile menu open/close while signed-in
- Admin Preview visibility on a draft course
- Locked vs accessible course rendering on `/courses/:id` for a real entitled user

…cannot be evidenced from this runner. They are validated by unit/component tests (201 passing) and must be re-validated by external audit on the hosted preview with real accounts.

### HOSTED_PREVIEW_URL

Workspace preview (always reflects the active edit-branch which is derived from `prelaunch-phase-2-3-official-render`):
`https://id-preview--aa3b388c-6623-43ee-8740-326108415543.lovable.app`

Use this URL for external authenticated QA. No separate `publish` was run (Phase 2.5 is read-only deploy; `preview_ui--publish` was intentionally not invoked).

---

## Issues found / fixed in this batch

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | P1 | Mobile menu used dark-sidebar foreground tokens on a light background → ~1.3:1 contrast | Scoped overrides in `official-render.css` under `.aa-mobile-menu` |
| 2 | P0 | `CourseDetail` showed Modules overview + linkable module cards even when `!accessible` → bypass to private module pages (RLS catches it server-side but UX leaked structure) | Suppressed Modules overview when `!accessible` |
| 3 | P0 | `CourseDetail` aggregated materials from every published lesson regardless of access | Filtered to `is_preview === true` lessons when `!accessible` |
| 4 | P0 | `CourseDetail` rendered full course-level QuizCard list to locked visitors | Hidden when `!accessible` |
| 5 | P1 | `CourseCard` with `locked: true, href: "/plans"` dropped the link entirely and showed disabled "Available soon", breaking the documented "curso bloqueado leva a planos" contract | `canVisit` no longer excludes `locked`; CTA copy becomes "View plans" when locked |
| 6 | P2 | `CourseCard` lacked an explicit test for the locked→/plans contract and for locked-without-href | Added two tests |

---

## Risks

- The mobile menu fix is purely additive CSS; desktop sidebar tokens are unchanged. Visual regression risk: low.
- `CourseDetail` locked-state changes alter only conditional rendering for `!accessible`. Accessible/admin paths are byte-for-byte identical except for `startHref` which now requires `accessible` — but `accessible` is `true` for admins and for users with valid entitlements, so no regression for legitimate paths.
- `CourseCard` change widens `canVisit` to include `locked` when `href` exists. Any existing caller that passed `locked: true` *without* `href` keeps the disabled button. The only caller in this batch (`Modules.tsx`) already passes `href: locked ? "/plans" : ...`.

---

## Scope guarantees

| Constraint | Status |
|------------|--------|
| `DATABASE_CHANGES` | **ZERO** |
| `STRIPE_CHANGES` | **ZERO** |
| `MAIN_CHANGED` | **NO** |
| `PR_MERGED` | **NO** |
| New player work | not started |
| New Home work | not started |
| New Admin work | not started |
| Migrations applied | none |
| Schema changes | none |
| Mocks substituted for real data | none — public QA was real navigation against the running app |

---

## Final Status Block

```
TECHNICAL_AUDIT=COMPLETE
MOBILE_CONTRAST=FIXED
GLOBAL_TOKEN_REGRESSION=NONE
LOCKED_COURSE_SECURITY=HARDENED
TYPECHECK=PASS
TEST_FILES=29
TESTS_PASSED=201
TESTS_FAILED=0
LINT=PASS (0 errors, 17 pre-existing warnings)
BUILD=PASS
PLAYWRIGHT=PUBLIC_ONLY (12 viewport×route captures)
SCREENSHOTS=/tmp/browser/p25/screens/ (12 PNG)
CONSOLE_ERRORS=NONE
DIRECT_REFRESH=PASS (all routes redirect cleanly to /login when unauth)
AUTHENTICATED_BROWSER_QA=NOT_RUN (external_unmanaged — see runner limitation)
DATABASE_CHANGES=ZERO
STRIPE_CHANGES=ZERO
MAIN_CHANGED=NO
PR_MERGED=NO
```

**STOP — awaiting external authenticated audit on hosted preview before unlocking Player / Home / Admin / secondary routes.**
