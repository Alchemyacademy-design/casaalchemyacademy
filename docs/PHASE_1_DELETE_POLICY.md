# Phase 1 — Admin Deletion Policy

The Phase 1 brief forbids physical deletion as a "default-safe" pattern. The
new `AdminTablePage` therefore exposes a `deletionMode` prop with three
explicit modes; the default is **`disabled`**.

## Modes

| Mode | Effect | Requirement |
|------|--------|-------------|
| `disabled` (default) | No destructive button is rendered. Edit only. | None — always safe. |
| `archive` | Sets `archived_at = now()`; default list filters `archived_at IS NULL`. | Table must have an `archived_at` column. Status enum is **not** mutated. |
| `hard` | Physical `DELETE`. **Not enabled on any table in Phase 1.** | Last-resort only; requires explicit approval. |

`archive` does not touch the `status` column. It does not validate enums. It
relies entirely on the existing `archived_at` column. Restoration is intended
but deliberately not built in Phase 1 — the column-only filter makes the
future "Show archived" toggle straightforward.

## Per-table assignment

### `deletionMode="archive"` — supported by `archived_at`

- `events`
- `live_workshops`
- `courses` *(used via the bespoke `AdminCoursesList` editor, not `AdminTablePage`)*
- `course_modules` *(used via the bespoke course editor)*
- `lessons` *(used via the bespoke course editor)*
- `community_posts` *(moderated via `AdminPanel`, not `AdminTablePage`)*
- `community_replies` *(moderated via `AdminPanel`, not `AdminTablePage`)*

`AdminEvents` and `AdminWorkshops` are the two `AdminTablePage` consumers that
already render a destructive button; both are configured for `archive`. The
remaining tables listed above have `archived_at`-based soft-delete supported
end-to-end at the schema level and will be wired into their bespoke editors
in a follow-up.

### `deletionMode="disabled"` — kept disabled in Phase 1

| Table | Why disabled | Future direction |
|-------|--------------|------------------|
| `suppliers` | Has `status` but no `archived_at`. | Move to `archive` once `archived_at` exists on `suppliers`. |
| `exclusive_deals` | Has `status` but no `archived_at`. | Same path as `suppliers`. |
| `magazine_issues` | Has `status` but no `archived_at`. | Same path as `suppliers`. |
| `membership_plans` | No `archived_at`; tied to Stripe prices. | Use `active = false` to hide from the public storefront — never delete. |
| `certificates` | No `archived_at`. | Use `revoked_at = now()` instead of delete. |
| `supplier_categories` | No `archived_at`; deletion would cascade into supplier rows. | Add an enum-checked decommission flow and migrate suppliers before any hide/remove. |

## What does **not** receive `hard`

No table receives `hard` in Phase 1. The mode exists for completeness; it is
intentionally absent from every consumer of `AdminTablePage`.

## How to flip a table later

1. Confirm the table has the relevant soft-delete column (`archived_at`,
   `revoked_at`, `active`).
2. Set `deletionMode="archive"` on the corresponding `Admin*.tsx` page.
3. If the soft-delete column is not `archived_at`, extend `AdminTablePage`
   with an `archive` adapter — do not write through the generic path.
4. Update `docs/PHASE_1_DELETE_POLICY.md` in the same change.
5. Add an end-to-end test that asserts the row is hidden after archive and
   that the column was written, not deleted.

## Stripe / financial tables

Stripe-bearing tables (`memberships`, `course_entitlements`,
`stripe_payments`, `stripe_checkout_sessions`, `stripe_events`) are **not**
exposed through `AdminTablePage` and must never receive `hard` deletion from
the admin UI. They follow the Stripe lifecycle (refund / cancel / void).
