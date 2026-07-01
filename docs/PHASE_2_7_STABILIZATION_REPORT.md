# Phase 2.7 — Functional Stabilization Report

## Scope delivered
1. **Profile avatar upload** — `AvatarUpload` component on `/profile`, writes to
   `public-assets` bucket under `avatars/<user_id>/…`, saves public URL to
   `profiles.avatar_path`. `CommunityPremium` already reads this field, so the
   photo automatically appears next to posts and replies.
2. **New Course form parity** — `/admin/courses/new` now captures title, slug,
   subtitle, description **and cover thumbnail upload** in one step, then
   redirects to `/admin/courses/:id` where modules/lessons/quizzes are edited
   with the same editor used for existing courses.
3. **Dropbox video streaming** — `normalizeVideoUrl` rewrites
   `dropbox.com` / `www.dropbox.com` hosts to `dl.dropboxusercontent.com`
   (Dropbox otherwise wraps the file in an HTML preview even with `raw=1`).
   Existing tests continue to pass.

## Manual action required (Supabase SQL Editor)
Apply the storage policies so members can upload their avatar:

`docs/migrations/20260701000000_public_assets_avatar_policies.sql`

Without this migration the upload button returns "row-level security" errors.

## Files touched
- `src/manus/components/AvatarUpload.tsx` (new)
- `src/manus/pages/Profile.tsx`
- `src/manus/pages/admin/AdminCourseDetail.tsx`
- `src/manus/lib/video-url.ts`
- `docs/migrations/20260701000000_public_assets_avatar_policies.sql` (new)

## Not delivered in this pass
- Full Playwright/CI matrix for every admin↔member surface
- Community end-to-end regression suite
- Consolidated integration matrix doc

These remain tracked in `.lovable/plan.md`.
