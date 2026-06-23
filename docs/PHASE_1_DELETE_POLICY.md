# Phase 1 — Admin Deletion Policy (updated)

The Phase 1 brief forbids physical deletion of editorial content. The unified
`AdminTablePage` exposes a `deletionMode` prop with three modes — default
`disabled`. **`hard` is not used by any caller in Phase 1.**

## Modes

| Mode | Effect | Requirement |
|------|--------|-------------|
| `disabled` (default) | No destructive button rendered. Edit only. | None — always safe. |
| `archive` | `update({ archived_at: now(), ...archivePatch })`. Lists filter `archived_at IS NULL`. Per-table `archivePatch` (e.g. `{ status: 'archived' }`) lets callers add table-specific flags without `AdminTablePage` assuming every archivable table has the same columns. | Table must have `archived_at`. |
| `hard` | Physical `DELETE`. **Unused in Phase 1.** | Last-resort only; requires explicit approval. |

## Bespoke editors (outside `AdminTablePage`)

The bespoke course editor (`AdminCourseDetail.tsx`) and the bulk lesson editor
(`AdminLessonsBulk.tsx`) used to call physical `DELETE` via `deleteModule` /
`deleteLesson` and `supabase.from('lessons').delete()`. Those helpers were
**removed** and replaced with:

- `archiveModule(id)` — sets `archived_at = now(), status = 'archived'`.
- `archiveLesson(id)` — sets `archived_at = now(), status = 'archived'`.
- `AdminLessonsBulk` "trash" button is now `bulkArchive`, calling
  `update({ archived_at, status: 'archived' }).in('id', ids)`.

Confirmation copy explicitly states the row can be restored. Toasts say
"Archived". Archiving a module **does not** auto-archive its lessons — the
confirmation makes that explicit.

The catalog reads (`listCourses`, `listModules`, `listLessons`,
`services/admin-content.getCourses/getCourseModules/getLessons`, and the
`admin-content-catalog` edge function) now filter `archived_at IS NULL` so
archived rows disappear from default admin and learner views without a
migration.

### Negative search performed

Searches that must remain empty in editorial flows for
`courses` / `course_modules` / `lessons`:

```
.delete()
deleteLesson
deleteModule
"Delete lesson"
"Delete this module"
```

All editorial call sites are clean. The two remaining `.delete()` occurrences
in the codebase are in `admin-manage-user-access` (account membership cleanup)
and `useCommunityData` / `usePublicContent` (community moderation), both
outside the courses/modules/lessons editorial surface.

## Per-table assignment

### `deletionMode="archive"`

- `events` (AdminTablePage, `archivePatch={{ status: "archived" }}`)
- `live_workshops` (AdminTablePage, `archivePatch={{ status: "archived" }}`)
- `courses`, `course_modules`, `lessons` via bespoke editors (archive helpers).
- `community_posts`, `community_replies` (moderated via `AdminPanel`).

### `deletionMode="disabled"`

| Table | Why disabled | Future direction |
|-------|--------------|------------------|
| `suppliers` | No `archived_at`. | Add column, then flip. |
| `exclusive_deals` | No `archived_at`. | Same. |
| `magazine_issues` | No `archived_at`. | Same. |
| `membership_plans` | Tied to Stripe prices. | Use `active = false`. |
| `certificates` | No `archived_at`. | Use `revoked_at = now()`. |
| `supplier_categories` | No `archived_at`; cascades. | Decommission flow. |

## Stripe / financial tables

Stripe-bearing tables (`memberships`, `course_entitlements`,
`stripe_payments`, `stripe_checkout_sessions`, `stripe_events`) are not
exposed through `AdminTablePage` and never receive `hard` deletion.
