-- Phase 1 hotfix (corrected): unblock RLS by granting USAGE on the `private`
-- schema and EXECUTE on the helper functions that current policies reference.
--
-- Root cause of HTTP 403 / 42501 ("permission denied for function is_admin"):
-- the policies on `courses`, `course_modules`, `lessons`, `lesson_progress`,
-- `community_*` etc. invoke `private.is_admin()`, `private.has_course_access(bigint)`,
-- `private.has_active_plan_permission(public.plan_permission_key)` and
-- `private.can_access_channel(bigint)`. Those functions already exist; the
-- `anon` and `authenticated` roles simply lack USAGE on `private` and EXECUTE
-- on the functions, so the policy check fails with 42501.
--
-- DO NOT create or restore a `public.is_admin()` function — the canonical
-- helper lives in `private` and is the one referenced by the policies.
--
-- Apply via Supabase SQL Editor (project omzwtfnqffseemrlylwu).

begin;

grant usage on schema private to anon, authenticated;

grant execute on function private.is_admin()
  to anon, authenticated;

grant execute on function private.has_course_access(bigint)
  to anon, authenticated;

grant execute on function private.has_active_plan_permission(public.plan_permission_key)
  to anon, authenticated;

grant execute on function private.can_access_channel(bigint)
  to anon, authenticated;

commit;
