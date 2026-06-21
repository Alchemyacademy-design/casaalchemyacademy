-- Phase 1 hotfix: restore public.is_admin used by existing RLS policies.
-- Apply via Supabase SQL Editor (project omzwtfnqffseemrlylwu).
-- Impact: unblocks REST reads on courses, lesson_progress (HTTP 403 / 42501).

create or replace function public.is_admin(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(coalesce(_user_id, auth.uid()), 'admin'::public.app_role);
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;
