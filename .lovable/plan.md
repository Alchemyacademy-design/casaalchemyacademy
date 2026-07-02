# Plan — Admin Course Authoring (parity with seeded courses)

## Goal
Let the admin create a new course from the Admin Center and have it render in the Member Area with the exact same structure, thumbnail, player, sidebar, quiz, ratings and comments as the seeded courses — no manual SQL, no hidden fields.

## Gaps today
1. **New Course** form only captures a subset of what seeded courses have (missing `summary`, `hero_image_url`, `access_plan_keys`, `sort_order`, publish state parity).
2. **Modules / Lessons** creation works, but there is no single wizard that guides `Course → Module → Lesson → Quiz` in one flow, so new courses look "empty" in the member area until every piece is added.
3. **Publish gate**: seeded courses render because `published = true` and `access_plan_keys` includes an active plan. New courses currently default to unpublished / empty plan keys, so members don't see them.
4. **Thumbnail parity**: seeded courses use square cover art in `public-assets`. The admin form accepts a URL but doesn't validate ratio/host, so tiles break.
5. **Preview parity**: admin can preview a lesson, but there is no "View as member" link that opens the exact `/courses/:slug` route to confirm rendering.

## Deliverables

### 1. Course form parity (`AdminCourseDetail` → New Course dialog)
Fields, all validated with zod:
- Title (2–120), Slug (auto from title, editable, `^[a-z0-9-]+$`)
- Subtitle, Summary (short marketing line used on the course card)
- Description (long)
- Cover thumbnail: upload to `public-assets/course-covers/` OR paste URL (accept Dropbox, normalized)
- Hero image (optional, same uploader)
- Access plans: multi-select from `membership_plans` (`monthly`, `annual`, `single_course`) — default all three so it appears for every paying member
- Sort order (number, default = max+1)
- Published toggle (default ON so it renders immediately)

### 2. Guided authoring wizard
After "Create course" succeeds, the dialog transitions to:
- **Step 2 — Add first module** (title, summary, sort_order auto)
- **Step 3 — Add first lesson** (title, Dropbox/YouTube/Vimeo/MP4 URL, duration, thumbnail, published)
- **Step 4 — Optional quiz** (reuses `AdminQuizEditor` with scope pre-selected to that lesson/module)
- **Finish** → toast "Course live" + button "Open as member" linking to `/courses/:slug`.

Every step uses the resilient `admin-content-create` edge function with the direct-insert RLS fallback already in place, plus the 8s/15s timeout guards.

### 3. Render parity in the member area
- `Courses` list already reads from `public.courses where published = true` ordered by `sort_order` — no change needed once form defaults are correct.
- `CourseDetail` / `ModuleDetail` already pick up modules, lessons, quizzes, ratings and comments generically, so a properly-seeded new course renders identically.
- Add a defensive `useMemo` fallback so a course with zero modules shows an "Author is preparing modules" empty state instead of a blank page (prevents the "looks broken" moment right after Step 1).

### 4. Admin UX polish
- "View as member" button on `AdminCourseDetail` header → opens `/courses/:slug` in a new tab (admins already have full student view).
- Inline validation errors under each field (already partially done, extend to cover/hero uploads).
- Duplicate-slug check before submit (query `courses` by slug, show inline error).

### 5. Storage
No schema changes required. Reuse existing `public-assets` bucket (`course-covers/`, `course-heroes/` prefixes). File size limits already raised to 50 MiB.

## Technical notes
- Files touched: `src/manus/lib/admin-content.ts` (extend `createCourse` schema + payload), `src/manus/pages/admin/AdminCourseDetail.tsx` (wizard UI + View-as-member link), `src/manus/pages/admin/AdminCourses.tsx` (New Course entry), `src/manus/components/admin/FileUploadField.tsx` (reuse), `supabase/functions/admin-content-create/index.ts` (accept new optional fields — backwards compatible).
- No new DB migration: `courses` already has `summary`, `hero_image_url`, `access_plan_keys`, `sort_order`, `published`.
- No changes to member-area components — parity is achieved by populating the same columns the seeded courses use.

## Out of scope
- Reordering modules/lessons by drag-and-drop (separate request).
- Bulk import from CSV.
- Custom per-course themes.

Approve and I will implement in a single pass.