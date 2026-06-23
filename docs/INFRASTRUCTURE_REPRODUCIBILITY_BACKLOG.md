# Infrastructure Reproducibility Backlog

Items the Phase 1 audit confirmed are **functional in the live database** but
not yet versioned in `supabase/migrations/`. None of them blocks Phase 1
shipping, but each represents a reproducibility risk if the project is
rehydrated from migrations alone.

The Phase 1 brief explicitly forbids touching `supabase/migrations/`,
`schema`, RLS, data, secrets or Stripe in this execution, so this document
captures the work without performing it.

## 1. Admin role hardening

- **Live state:** `protect_designated_admin_trg` trigger exists and prevents
  the designated admin row from losing its admin role. Verified via direct
  SQL inspection.
- **Source state:** trigger DDL lives only in `docs/migrations/` and not in
  the official `supabase/migrations/` pipeline.
- **Risk:** A fresh `supabase db reset` would drop the trigger.

## 2. `private` schema grants

- **Live state:** `private` schema exists; the `service_role` and the
  designated admin have the grants required for the audit helpers.
- **Source state:** Grants not present in the official migration pipeline.
- **Risk:** Same as above.

## 3. Realtime publication membership

- **Live state:** `community_posts`, `community_replies`,
  `community_reactions` are members of `supabase_realtime`. Verified during
  the Phase 3 audit.
- **Source state:** The `ALTER PUBLICATION` statements are not versioned.
- **Pending addition:** `lesson_progress` is **not** in the publication and
  cannot be added in Phase 1 (would touch schema). The cross-tab
  invalidation bridge in `src/manus/lib/cross-tab-query-sync.ts` is the
  Phase-1-safe substitute.

## 4. Soft-delete columns

- **Live state:** `archived_at` exists on `courses`, `course_modules`,
  `lessons`, `events`, `live_workshops`, `community_posts`,
  `community_replies`.
- **Source state:** Column definitions live in the live schema only; they
  are not visible in `supabase/migrations/`.
- **Risk:** Reproducing the project from migrations would lose the columns
  and break the `deletionMode="archive"` adapter.

## 5. Storage bucket and policies

- **Live state:** Public bucket `public-assets` is configured and used by
  `ThumbnailField` uploads.
- **Source state:** Bucket creation and access policies are not part of the
  migration pipeline.

## 6. RLS policies on admin-only tables

- **Live state:** Admin RLS policies enforce admin-only writes on
  `courses`, `course_modules`, `lessons`, `events`, `live_workshops`,
  `magazine_issues`, `suppliers`, `exclusive_deals`, `membership_plans`,
  `certificates`.
- **Source state:** Policies exist in the live DB but the canonical
  `CREATE POLICY` statements need to be captured in
  `supabase/migrations/`.

## Suggested ordering when work resumes

1. Snapshot the live schema into a single migration tagged
   `phase_1_followup_capture` (read-only DDL dump, no destructive
   statements).
2. Split the dump into focused migrations per topic above so each can be
   reviewed independently.
3. Add a CI step that runs `supabase db reset && supabase db push` in a
   throwaway project to detect drift on every PR.
4. Add a migration test that asserts the presence of `archived_at` on the
   seven tables listed in §4 and rejects the PR if any column is missing.

None of these steps are performed in Phase 1.
