## Root cause

`supabase.functions.invoke("admin-content-create", …)` is called with no timeout from `invokeAdminCreate` in `src/manus/lib/admin-content.ts`. When the edge function cold-starts, blocks on CORS, or the JWT hasn't refreshed yet, the Promise never resolves and never rejects — so:

- `createCourse.mutate()` in the New course form stays `isPending: true` forever ("Creating…" button spinner never stops).
- The client-side fallback (`supabase.from("courses").insert(...)`) sits inside the same `catch` branch and is never reached, because the outer call never throws.
- Same pattern hangs `handleAddModule` and `handleAdd` (lesson).

The recently added `window.prompt` in module/lesson creation is not the cause — prompts return synchronously; it's the invoke call that stalls.

## Fix

1. **Wrap `invokeAdminCreate` in a timeout race** (8s). If the edge function doesn't respond, throw a typed `EdgeTimeoutError` so the existing fallback (`supabase.from(...).insert(...)`) fires and the admin still gets the course/module/lesson created via RLS.
2. **Guard the auth session** before invoke. Call `supabase.auth.getSession()` once; if there's no `access_token`, skip the edge attempt entirely and go straight to the direct-insert fallback (avoids invisible 401 hangs after token refresh).
3. **Belt & suspenders on the mutation** in `AdminCourseDetail.tsx`: wrap `createCourse.mutationFn` in a 15s outer timeout so even a pathological hang inside the fallback surfaces a toast instead of an infinite spinner. Do the same for `handleAdd` (lesson) and `handleAddModule`.
4. **Reset spinner on any throw** — mutations already do this, but for `handleAdd`/`handleAddModule` (plain async) add a `finally` toast to unblock the UI.

## Files touched

- `src/manus/lib/admin-content.ts` — add `withTimeout` helper, session precheck, apply to `invokeAdminCreate`.
- `src/manus/pages/admin/AdminCourseDetail.tsx` — outer timeout around create mutation + handlers.

## Verification

- Deploy nothing new (no edge function changes). Reload admin, open New course, submit; if edge cold-starts the spinner stops in ≤8s and fallback insert wins. Same for Add module / Add lesson. Check console for a single `[admin-create] edge timeout, falling back` log.

## Out of scope

- Replacing `window.prompt` with a shadcn `Dialog` (better UX, not the reported bug).
- Retry/backoff on the edge function (fallback covers it).