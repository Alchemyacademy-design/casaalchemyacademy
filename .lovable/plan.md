
## Premortem — Why "New course" hangs today

Root causes observed in `src/manus/lib/admin-content.ts` + `AdminCourseDetail.tsx`:

1. **Every create call tries the edge function first.** `admin-content-create` cold-starts, occasionally 502s, and its 8s timeout is inside an *inner* Promise.race that still awaits `supabase.functions.invoke` — if the network layer never resolves, the race resolves but the invoke keeps its React Query mutation in `isPending` because the fallback path (direct insert) can itself stall on `slugTaken` / `maxRow` queries that are **not** wrapped in a timeout.
2. **`slugTaken()` is called twice inside the mutation** (once by the debounce effect, once inside `mutationFn`) with no timeout, so a slow Supabase round-trip freezes the button forever.
3. **Cover upload state is not race-protected**: if the storage upload silently stalls we never release the button.
4. The `admin_full_access` RLS policies (`docs/migrations/20260622000000_admin_full_access_policies.sql`) already give admins full write on `courses`, `course_modules`, `lessons`. The edge function is redundant for our current admin.

## Plan

Keep the UI unchanged; rewrite the data layer to use **Supabase directly** with strict timeouts and a single insert path.

### 1. `src/manus/lib/admin-content.ts`
- Add `withTimeout<T>(promise, ms, label)` helper.
- Replace `createCourse`, `createModule`, `createLesson` with **direct RLS inserts** (no edge function, no fallback branching). Each supabase call wrapped in `withTimeout(..., 8000)`.
- `createCourse` steps, all guarded:
  1. Validate input.
  2. Compute unique slug (loop up to 10 candidates, each check `withTimeout(4000)`).
  3. Fetch `max(sort_order)` `withTimeout(4000)`.
  4. Insert `withTimeout(8000)`; return row.
- `createModule` / `createLesson`: compute `sort_order` locally from caller-provided value, single insert `withTimeout(8000)`.
- Keep `invokeAdminCreate` removed. Delete unused code path.

### 2. `src/manus/pages/admin/AdminCourseDetail.tsx`
- Remove the second `await slugTaken(...)` inside `createCourse.mutationFn` — rely on the debounced check + `createCourse` internal loop.
- Wrap the mutation in outer `withTimeout(20000, "Create course")` as a final safety net.
- Add explicit `disabled` on the submit button while `newCoverUploading` is true (already present) and reset all local state on error.
- Same treatment for `handleAddModule` (module creation prompt path): wrap `createModule` call in `withTimeout(15000)`.

### 3. Keep edge function as-is but stop calling it
- `supabase/functions/admin-content-create/index.ts` stays deployed for backward compat but is no longer invoked from the client. This eliminates the cold-start hang class of bugs entirely.

### 4. Verification
- `bunx vitest run` on existing admin-content tests.
- Manual: create course with unique title → lands on `/admin/courses/:id#modules` in <2s. Add module via prompt → appears in list. Add lesson inside module → appears with sort_order set. Force offline → button shows error toast within 8s, never hangs.

### Technical notes
- No schema change, no new migration — `admin_full_access` policy already covers the writes.
- `service_role` grant path is preserved for the (unused) edge function.
- No changes to member area or quiz code.
