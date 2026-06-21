# Admin Center — Phase 2 Consolidation Report

**Project:** alchemy-academy-preview · `main`
**Supabase ref:** `omzwtfnqffseemrlylwu`
**Designated platform admin:** `contact@casaalchemystudio.com`

## Bidirectional matrix (frontend ⇄ Supabase)

| Area             | Admin route                  | Supabase table(s)                                 | CRUD ops                                  | Public surface that re-reads it   |
|------------------|------------------------------|---------------------------------------------------|-------------------------------------------|-----------------------------------|
| Courses          | `/admin/courses`, `/admin/courses/:id` | `courses`, `course_modules`, `lessons` | C/R/U/D, reorder, status, video, cover  | `/courses`, `/mycourses/:id`     |
| Lessons (bulk)   | `/admin/lessons`             | `lessons`                                         | R/U (video URL, status)                   | `/mycourses/:id`                 |
| Students         | `/admin/students`, `/admin/users/:id` | `profiles`, `user_roles`, `memberships`, `course_entitlements`, `stripe_*` | R (list), role promote/demote, grant/revoke membership/entitlement, Stripe sync/cancel | `/dashboard`, `/profile` |
| Events           | `/admin/events`              | `events`                                          | C/R/U/D                                   | `/events`                         |
| Live workshops   | `/admin/workshops`           | `live_workshops`                                  | C/R/U/D                                   | `/live-workshops`                 |
| Magazine         | `/admin/magazine`            | `magazine_issues`                                 | C/R/U/D                                   | `/magazine`                       |
| Suppliers        | `/admin/suppliers`           | `suppliers`                                       | C/R/U/D                                   | `/suppliers`                      |
| Categories       | `/admin/supplier-categories` | `supplier_categories`                             | C/R/U/D                                   | `/suppliers`                      |
| Deals            | `/admin/deals`               | `exclusive_deals`                                 | C/R/U/D                                   | `/dashboard`                      |
| Plans            | `/admin/plans`               | `membership_plans`                                | C/R/U/D                                   | `/plans`                          |
| Certificates     | `/admin/certificates`        | `certificates`                                    | C/R/U/D                                   | `/profile`                        |
| Diagnostics      | `/admin/diagnostics`         | `admin-content-catalog` edge + RLS fallback       | R only                                    | —                                 |
| Analytics        | `/admin/analytics`           | aggregates                                        | R only                                    | —                                 |

All writes go through `supabase.from(...)` / SECURITY DEFINER edge functions; no mocks, no hardcoded arrays. React Query invalidates both admin and public keys after each mutation.

## Auth & access

- `useAuth()` reads from a single `AuthProvider`. Exposes `session`, `user`, `roles`, `isAdmin`, `authReady`, `accessReady`, `loading`, `defaultPath`, `refreshAccess`, `logout`.
- `AdminGuard` (in `src/components/AdminGuard.tsx`) blocks non-admins.
- Designated admin (`contact@casaalchemystudio.com`) is protected by the `protect_designated_admin` trigger.

## Required DB step (one-off, idempotent)

Run `docs/migrations/20260622000000_admin_full_access_policies.sql` in the Supabase SQL Editor of project `omzwtfnqffseemrlylwu`. It adds (or refreshes) the `admin_full_access` RLS policy and the `authenticated` / `service_role` GRANTs on every secondary content table the new CRUD pages target.

Without this migration, `events`, `magazine_issues`, `suppliers`, `exclusive_deals`, `membership_plans`, `certificates`, etc. may return `permission denied` when the admin attempts to write.

## Status

- Routing: 100% on `react-router-dom`; `wouter` removed from `src/`.
- Typecheck (`npx tsc --noEmit`): passing.
- Build / lint / vitest: run by Lovable build pipeline on every push.
- Courses / Modules / Lessons CRUD: functional (inline auto-save, drag-drop reorder, status transitions, video upload, cover upload, publish checklist).
- Users CRUD: functional (promote, demote, grant/revoke membership & entitlement, Stripe resync / cancel).

## Pending (out of Phase 2 scope)

- Community moderation UI (`community_*`, `moderation_actions`) — tables ready, dedicated UI not built.
- Quizzes nested editor inside the course editor.
- Public pages still read seed data from `manus/data/manus-import.json` for fallback; swap to live `useQuery` is Phase 3.
