# Phase 2.8 — Full platform stabilization + English-only UI

Two goals, one pass:
1. Every user-facing string in English (Home + Admin já estão; Community é o maior offender).
2. Fix concrete broken integrations found in the audit.

---

## Part A — Language (English everywhere)

**Community is the biggest gap (~60 PT strings across 4 files).** Everything else is already EN.

Files to translate in one sweep:
- `src/manus/components/community/CommunityPremium.tsx` — 40+ strings (toasts, placeholders, buttons, aria-labels, empty states, `window.confirm`s).
- `src/manus/components/community/CommunityCenter.tsx` — 20+ strings (kept only if we don't delete it — see B-6).
- `src/manus/components/community/CommunityDialogs.tsx` — "Novo Space", "Novo canal", labels, placeholders, toasts.
- `src/manus/pages/Community.tsx` — `aria-label="Carregando conversa"`.

Approach: direct string replacement (no i18n framework — Home/Admin are hard-coded EN, we stay consistent).

---

## Part B — Functionality fixes (priority order)

| # | Area | Fix |
|---|------|-----|
| B-1 | **ModuleRating** hard-errors — table/RPC not in DB | Guard the component: render nothing (or "Ratings coming soon") when the query returns a Postgres "relation does not exist" error, so module pages don't crash. Migration stays pending for a follow-up turn. |
| B-2 | **Community delete via `window.confirm`** blocked on iOS WebView | Replace both confirms in `CommunityPremium.tsx` with shadcn `<AlertDialog>`. |
| B-3 | **Post-payment nav** goes to public Guides page | `PaymentSuccess.tsx` + `PaymentCancel.tsx`: `navigate("/mycourses")`. |
| B-4 | **Full-reload `<a href>`** in member area | Convert to `<Link>` / `useNavigate` in `Events.tsx`, `LiveWorkshops.tsx`, `Suppliers.tsx`. |
| B-5 | **Dashboard `ComingUp`** fires auth queries when logged out | Add `enabled: isAuthenticated` to `useMyRegistrations` / `useRegisterForTarget`. |
| B-6 | **Duplicate Community component** (`CommunityCenter` vs `CommunityPremium`) | Confirm `CommunityPremium` is the live one (it's what `Community.tsx` imports); delete `CommunityCenter.tsx` + its test. Removes half the PT translation work too. |
| B-7 | **Stale "Stripe billing coming soon" banner** in `Plans.tsx` + inline error string in `SubscribeModal` | Gate both behind `VITE_BILLING_ENABLED` env flag; when unset, keep current disabled-state but drop the hard-coded banner text and check the flag instead of matching error strings. |
| B-8 | **Community CTA** in `ModuleDetail` → `?channel=undefined` | Only render the CTA button when `ctaChannelMap` has a match. |
| B-9 | **"Logout" vs "Sign out"** in `MemberLayout` | Standardize to "Sign out". |
| B-10 | **Magazine hardcoded video path** | Read from `magazine_issues.video_url` (nullable); fallback to hiding the section — no new column required if we reuse `external_file_url` when present. |
| B-11 | **PaymentSuccess infinite polling** | Cap `refetchInterval` after 10 attempts, then show "Still processing — refresh in a minute." |
| B-12 | **Silent certificate errors** | Add `toast.error` in `CertificateSection` catch block. |
| B-13 | **Plans "Contact us" button** permanently disabled | Turn into `<a href="mailto:contact@casaalchemystudio.com">`. |

---

## Out of scope (explicit)
- Stripe / checkout / webhook logic changes.
- New DB migrations (module_ratings migration remains a follow-up; B-1 just prevents the crash).
- Design/visual redesign, image swaps, admin surface refactors.
- Auth schema.

---

## Verification
- `bun test` + `tsgo` + `bun run build`.
- Playwright smoke: `/dashboard`, `/community`, `/mycourses`, `/courses/:slug`, `/plans`, `/profile`, logged-out `/dashboard`.
- Grep sweep for remaining non-EN strings: `rg "ção|ão|õe|ê|ú|Não|Você|Cancelar|Publicar|Responder|Remover|Buscar|Nenhum" src/manus src/pages src/components`.

## Deliverable
- Code changes above.
- `docs/PHASE_2_8_STABILIZATION_REPORT.md` with before/after string counts and per-fix status.

Confirmar para eu executar? Ou quer que eu ajuste escopo (ex.: adiar B-7/B-10, incluir tradução de emails)?