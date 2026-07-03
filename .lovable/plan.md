# Plan — Course Management (Phase 3)

Build on top of Phase 2 schema (already migrated: `courses` with `status/visibility/access_type/release_type/scheduled_publish_at`, `course_categories`, `course_modules.position`, `lessons.position`, `course_audit_logs`, private `course-assets` bucket). No new migrations required for this phase — the columns needed already exist. If a real gap appears mid-build, I'll add one incremental migration and stop for approval.

## 1. Route & navigation
- New route `/admin/course-management` (label: **Course Management**) in `AdminShell` sidebar, above existing `Courses`.
- Keeps legacy `/admin/courses` list working (no destructive changes).

## 2. Data layer (`src/manus/lib/course-management.ts`)
- `listCourses({ search, status, instructorId, categoryId, from, to, sort, page, pageSize })` → single Supabase query on `courses` with joins to `profiles` (instructor), `course_categories`, and aggregates:
  - lesson count via `lessons` join through `course_modules`
  - enrollment count via `course_entitlements` (active)
  - avg progress via `lesson_progress` (bounded, best-effort)
- `listInstructors()` / `listCategories()` — small cached lookups.
- `createCourseDraft(input)` — insert with `status='draft'`.
- `updateCourseStage(id, patch)` — used by wizard steps.
- `publishCourse(id, { immediate | scheduledAt })` — sets `status='published'|'scheduled'`, `published_at`, `scheduled_publish_at`.
- `reorderModules(courseId, ids[])` and `reorderLessons(moduleId, ids[])` — batched `update ... position` via `upsert`.
- `duplicateModule(id)`, `duplicateLesson(id)`, `moveLesson(id, toModuleId)`, `softDeleteModule(id)`, `softDeleteLesson(id)`, `toggleHidden(entity,id)`.
- All writes use existing admin RLS; each is wrapped in `withTimeout` (8s) to prevent infinite spinners.

## 3. Course Management page (`src/manus/pages/admin/CourseManagement.tsx`)
- Header: title + **Create new course** button (opens wizard modal).
- Toolbar row:
  - Search input (debounced 300ms, name/slug ilike).
  - Filters: Status (draft / in_review / scheduled / published / hidden / archived), Instructor (select), Category (select), Date range (from/to).
  - Sort dropdown: Name ↑↓, Updated ↑↓, Status.
  - View toggle: Cards ⇄ Table.
- Results: paginated (20/page), skeleton loading, empty state.
- Each course card/row shows: cover, title, status badge, instructor, category, lesson count, enrollment count, avg progress %, last updated.
- Row action menu: Edit · View as member · Duplicate · Publish/Unpublish · Archive · Delete (confirm modal) · Manage students · Performance (stubs link to existing pages when present).

## 4. Create-course wizard (`src/manus/components/admin/course-wizard/`)
Modal with progress stepper (1→4). State kept in a single `useReducer`. Draft saved after step 1 so navigation is safe.
- **Step 1 — Main info**: title, subtitle, auto slug (editable, live duplicate check debounced), short + long description, category, instructor, level, language, estimated duration, cover upload → `course-assets/covers/`, banner upload, trailer URL, tags multi-select, target audience, objectives (list), prerequisites (list), certificate toggle, featured toggle.
- **Step 2 — Access**: access_type radio (free / paid / plan_included / manual / user_exclusive / product_linked / period / lifetime / cohort). Selecting `plan_included` shows `access_plan_keys` checkboxes (annual / monthly / single_course). Period shows date range. Payment integration is *not* recreated — links to existing `stripe_prices` when `paid` is chosen (out of this phase's scope: creation of new Stripe prices).
- **Step 3 — Release**: release_type (all_now / drip_days / drip_date / after_prev_lesson / after_prev_module / manual / per_cohort). Numeric/date inputs revealed conditionally.
- **Step 4 — Review**: summary of everything with edit-back links; footer buttons: **Save as draft** · **Send for review** (status=in_review) · **Schedule** (opens datepicker → status=scheduled + scheduled_publish_at) · **Publish now** · **Preview as member** (opens `/courses/:id` in new tab).

Zod validation per step; step advances blocked on errors; inline error text (no browser alerts).

## 5. Visual builder (`src/manus/pages/admin/CourseBuilder.tsx` at `/admin/course-management/:id`)
Three-column layout (responsive: collapses to tabs on mobile).
- **Left — Structure**
  - Tree of modules → lessons.
  - `@dnd-kit/core` + `@dnd-kit/sortable` (already in tree if not, add via `bun add`) for drag-drop reordering.
  - On drop: optimistic reorder, batched `reorderModules`/`reorderLessons` write, rollback + toast on failure.
  - Per-node actions: rename inline, duplicate, hide/show, move-to-module, delete (confirm modal with content warning if progress exists).
  - Buttons: **Add module**, **Add lesson**, **Add quiz** (reuses `AdminQuizEditor`), **Add bonus content**.
- **Center — Lesson editor**
  - Reuses existing `LessonEditor`/blocks work already scaffolded; this phase wires it to the selected node and adds autosave indicator (Saving… / Saved · timestamp / Retry). Block editor evolution stays in a later phase — placeholder for missing block types.
- **Right — Settings panel**
  - Bound to selected lesson: name, slug, description, type, duration, status, mandatory, preview, release fields, prerequisite, allow comments/download, auto-complete-on-video-end, cover upload.
  - Bound to selected module: title, description, status, release fields, prerequisite module.
  - Debounced autosave (500ms) with the same indicator.

## 6. UX guarantees
- All spinners have hard 15s timeout with error toast.
- No browser `confirm()` — use existing shadcn `AlertDialog`.
- Every mutation invalidates the correct react-query keys so the list + builder stay in sync.
- Empty/skeleton/error states for every list.

## 7. Out of scope (later phases, per Fase 5)
- Full block editor palette (image gallery, quiz-in-block, code embed, live class widgets).
- Course templates gallery, content assistant, version history UI, analytics dashboards, cohort management, drip actual enforcement on the student side beyond flags currently respected.
- Instructor-scoped roles UI (schema already supports; admin management page comes with the roles admin work).

## 8. Files to add / touch
```text
src/manus/components/admin/AdminShell.tsx           (+ nav item)
src/App.tsx                                         (+ 2 routes)
src/manus/lib/course-management.ts                  (new)
src/manus/pages/admin/CourseManagement.tsx          (new)
src/manus/pages/admin/CourseBuilder.tsx             (new)
src/manus/components/admin/course-wizard/
  Wizard.tsx, Step1Main.tsx, Step2Access.tsx,
  Step3Release.tsx, Step4Review.tsx, schema.ts      (new)
src/manus/components/admin/course-builder/
  StructureTree.tsx, LessonSettings.tsx,
  ModuleSettings.tsx, AutosaveBadge.tsx             (new)
```
No existing feature is removed or renamed; `AdminCourseDetail` stays as the legacy editor and the new builder becomes the recommended entry.

Say **go** to build, or tell me which pieces to trim / expand.
