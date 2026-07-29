# Plan — Persistent "Back" navigation across every screen

## Goal
Improve UX by giving users a consistent, always-visible way to return to the previous screen — a Back control at the top AND at the bottom of every page (public, members and admin), without breaking existing headers/layouts.

## Approach — single shared component

Create a new `BackNav` component used in two flavors:

- **Top variant** — small pill button ("← Back"), placed just above the page content, sticky under the header on scroll.
- **Bottom variant** — full-width strip at the end of the main content ("← Back" + optional "Top ↑"), rendered before the footer.

Behavior:
- If `history.length > 1` and the referrer is same-origin → `navigate(-1)`.
- Otherwise → fallback to a smart route (`/dashboard` for members, `/` for public, `/admin` for admin routes).
- Hidden on landing (`/`), on login/signup entry screens, and inside modals/dialogs (to avoid duplicate close controls).
- Fully keyboard-accessible (`aria-label="Go back"`), 44px min touch target, respects existing gold theme tokens.

## Wiring — 3 layout entry points, no per-page edits

Injecting the Back controls into the three layouts covers 100% of pages automatically:

1. **`MemberLayout.tsx`** — wrap `<main>` children with `<BackNav variant="top" />` above and `<BackNav variant="bottom" />` below. Covers Dashboard, Courses, Modules, Community, Events, Magazine, Suppliers, Deals, Profile, Workshops, Notifications.
2. **`AdminPanel` / admin pages layout** — same wrapping inside the admin shell. Covers every `/admin/*` page and Course Management tabs.
3. **Public pages** (`Home`, `Plans`, `Magazine` public, legal pages, `Support`, `Login`, `Signup`, `PaymentSuccess/Cancel`, `PublicCertificate`, `CourseQuiz`, `FreeLesson`) — add a small `<PublicPageFrame>` wrapper OR mount `BackNav` directly at the top of each page. Since these pages don't share a single layout, we add a lightweight `PublicShell` wrapper and adopt it where needed (skipping `/` landing).

## Files to add / edit

- **Add** `src/manus/components/BackNav.tsx` — the shared component (top + bottom variants, smart fallback, hide-rules by pathname).
- **Add** `src/manus/components/PublicShell.tsx` — thin wrapper that renders `BackNav` around children for pages without an existing layout.
- **Edit** `src/manus/components/MemberLayout.tsx` — inject BackNav around `{children}`.
- **Edit** admin layout wrapper (inside `AdminPanel.tsx` / admin pages) — inject BackNav.
- **Edit** the ~10 public pages listed above to use `PublicShell` (or mount `BackNav` inline). Skip `/`.
- **Edit** `src/index.css` — add small `.aa-backnav` styles matching the gold/serif system.

## Technical details

- Uses `useLocation` + `useNavigate` from `react-router-dom` (already installed).
- Top variant: `position: sticky; top: 0; z-index: 30;` with backdrop blur so it stays reachable during long scroll.
- Bottom variant: full-width bar with divider, includes "Back to top" secondary link.
- Skip-list is a small `SKIP_BACK_ROUTES = ["/", "/login", "/signup"]` (regex-friendly for nested paths if needed).
- No behavior change to browser back button; this only adds an in-page control.
- No changes to auth, data-fetching, or business logic.

## Verification

- Playwright pass across `/dashboard`, `/mycourses`, `/community`, `/admin`, `/plans`, `/magazine`, `/support` — screenshot top + bottom.
- Confirm mobile viewport (<768px) shows both controls without overflow.
- Confirm click behavior: from `/community/general` → `/community`; deep link with empty history → falls back to `/dashboard`.
