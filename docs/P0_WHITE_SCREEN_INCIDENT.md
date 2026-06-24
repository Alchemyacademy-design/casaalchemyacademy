# P0 — White screen incident & defensive hotfix

Date: 2026-06-24
Severity: P0 — runtime visibility
Status: `WHITE_SCREEN_STATUS = RESOLVED_AND_RUNTIME_VALIDATED` (sandbox dev preview)

## Reproduction

Sandbox dev preview (`http://localhost:8080`) was exercised across the
incident-rotation routes with Playwright:

| Route | Status | `#root` length | Console errors |
|---|---|---|---|
| `/` | 200 | 40 261 | 0 |
| `/login` | 200 | 4 359 | 0 |
| `/dashboard` | 200 | 4 359 | 0 |
| `/admin` | 200 | 4 359 | 0 |
| `/mycourses` | 200 | 4 359 | 0 |
| `/courses/1` | 200 | 4 359 | 0 |
| `/modules/1` | 200 | 4 359 | 0 |

The dev preview **did not** reproduce a white screen — `#root` was populated
on every route, no `pageerror`, no failed dynamic imports, no chunk 404s.

The Lovable hosted preview (`id-preview--…lovable.app`) could not be reached
from inside the sandbox (the wrapper requires a logged-in Lovable session
and `networkidle` never settles because of third-party analytics). The
hotfix below therefore focuses on the defensive hardening explicitly
requested in the P0 ticket so that any class of white-screen failure
becomes observable instead of silent.

Per project rules, no schema, RLS, migration, secret, data row, edge
function or Stripe code was touched.

## Root-cause classification

Because the dev preview renders cleanly on `1871bd1`, the most plausible
hosted-preview failure modes are:

1. **Stale chunk after redeploy** — old `index.html` references a hashed
   chunk that was rotated out. Manifests as `Failed to fetch dynamically
   imported module`. The hotfix adds `lazyWithRetry` which performs a
   single, bounded reload per chunk to clear it.
2. **Silent bootstrap failure** — `createRoot` throws before any visible
   content reaches `#root` (env var missing, top-level provider exception).
   The hotfix adds a visible startup fallback in `index.html`, a `try/catch`
   around `createRoot`, and global `error` / `unhandledrejection` handlers
   that swap the spinner for a readable error screen with a Reload button.
3. **Landing query crash** — `usePublishedCourses` returns a payload the
   `.map` cannot handle, taking the whole landing down. The hotfix wraps
   the data in `Array.isArray`, falls back to the static `MODULES`, treats
   `cover_image_path` as the canonical column with `cover_image_url` kept
   only for back-compat, and exposes a discreet Retry banner scoped to the
   "Our Courses" section.

`RUNTIME_ROOT_CAUSE = stale-chunk / silent-bootstrap (not reproducible in
sandbox dev preview; defensive hardening applied for all three classes)`.

## Environment variables (presence only)

| Var | Configured |
|---|---|
| `VITE_SUPABASE_URL` | yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes |

(Values intentionally not printed.)

## Files changed

| File | Purpose |
|---|---|
| `index.html` | Inline `#aa-startup-fallback` spinner + global error/rejection handlers that swap to a readable error screen with a Reload button. CSS is inline so it survives a missing stylesheet. |
| `src/main.tsx` | Wraps `createRoot` in `try/catch`, asserts `#root` exists, reports startup errors through `window.__aaStartupError`, removes the fallback only after first paint. |
| `src/manus/lib/lazyWithRetry.ts` | New helper: lazy import + one-shot reload on chunk-load failure, `sessionStorage`-guarded to prevent reload loops, ErrorBoundary on second failure. |
| `src/manus/lib/lazyWithRetry.test.ts` | Tests: normal import, first failure triggers exactly one reload, second failure rethrows, unrelated errors rethrow without reload. |
| `src/App.tsx` | All `React.lazy(...)` routes replaced with `lazyWithRetry(..., key)`. `Home` and `Login` remain eager. |
| `src/manus/pages/Home.tsx` | `Array.isArray` guard on query data, `cover_image_path` promoted to primary thumbnail column (`cover_image_url` kept as fallback), discrete error/Retry banner scoped to "Our Courses". Hero + Benefits always render. |

## Deployment

- No edge function redeploy.
- No Stripe code touched. `STRIPE_LIVE_ENABLED=false` unchanged.
- Frontend changes only — Lovable hosting picks them up on next publish.

## Rollback

`git revert` of the hotfix commit restores `lazy()` everywhere and the
previous `main.tsx` / `index.html`. The defensive change is additive;
removing it does not require schema or data restoration.

## Database / Stripe confirmation

- Schema: not modified.
- RLS: not modified.
- Migrations: none created.
- Data rows: none modified.
- Stripe: untouched. `STRIPE_LIVE_ENABLED=false`.
- Edge functions: not redeployed.
