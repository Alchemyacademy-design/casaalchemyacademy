-- =====================================================================
-- Phase 1 + Phase 2 platform migration. Apply via Supabase SQL Editor.
-- Project ref: omzwtfnqffseemrlylwu
-- Idempotent. Safe to re-run.
-- =====================================================================
-- Contents:
--   1. Designated-admin auto-grant trigger
--   2. Designated-admin role-protection trigger
--   3. admin_access_audit_log table + policies
--   4. Private storage bucket `lesson-videos` + storage.objects policies
-- =====================================================================

------------------------------------------------------------
-- 1. Trigger: ensure designated admin always has admin role
------------------------------------------------------------
create or replace function public.ensure_designated_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is not null
     and lower(trim(new.email)) = 'contact@casaalchemystudio.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_designated_platform_admin_ins on auth.users;
create trigger ensure_designated_platform_admin_ins
after insert on auth.users
for each row execute function public.ensure_designated_platform_admin();

drop trigger if exists ensure_designated_platform_admin_upd on auth.users;
create trigger ensure_designated_platform_admin_upd
after update of email on auth.users
for each row execute function public.ensure_designated_platform_admin();

-- Backfill (idempotent)
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(trim(u.email)) = 'contact@casaalchemystudio.com'
on conflict (user_id, role) do nothing;

------------------------------------------------------------
-- 2. Protect designated admin from demotion / role removal
------------------------------------------------------------
create or replace function public.protect_designated_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_protected_id uuid;
begin
  select id into v_protected_id
  from auth.users
  where lower(trim(email)) = 'contact@casaalchemystudio.com'
  limit 1;

  if v_protected_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE'
     and old.user_id = v_protected_id
     and old.role = 'admin'::public.app_role then
    raise exception 'Cannot remove admin role from designated platform administrator';
  end if;

  if tg_op = 'UPDATE'
     and old.user_id = v_protected_id
     and old.role = 'admin'::public.app_role
     and new.role <> 'admin'::public.app_role then
    raise exception 'Cannot change admin role of designated platform administrator';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_designated_admin_role_trg on public.user_roles;
create trigger protect_designated_admin_role_trg
before update or delete on public.user_roles
for each row execute function public.protect_designated_admin_role();

------------------------------------------------------------
-- 3. Admin audit log
------------------------------------------------------------
create table if not exists public.admin_access_audit_log (
  id            bigserial primary key,
  actor_user_id uuid not null,
  target_user_id uuid,
  action        text not null,
  entity_type   text,
  entity_id     text,
  reason        text,
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz not null default now()
);

grant select on public.admin_access_audit_log to authenticated;
grant all    on public.admin_access_audit_log to service_role;
grant usage, select on sequence public.admin_access_audit_log_id_seq to service_role;

alter table public.admin_access_audit_log enable row level security;

drop policy if exists "admin read audit log" on public.admin_access_audit_log;
create policy "admin read audit log"
on public.admin_access_audit_log
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));
-- writes only via service_role (edge functions); audit trail is tamper-proof.

------------------------------------------------------------
-- 4. Private storage bucket: lesson-videos
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-videos',
  'lesson-videos',
  false,
  524288000, -- 500 MB
  array['video/mp4','video/webm','video/quicktime','video/x-m4v']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admins can fully manage objects in lesson-videos
drop policy if exists "lesson-videos admin all" on storage.objects;
create policy "lesson-videos admin all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'lesson-videos'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  bucket_id = 'lesson-videos'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Students never read storage.objects for lesson-videos directly. The
-- `lesson-video-url` edge function issues short-lived signed URLs after
-- confirming admin OR active membership OR matching course entitlement.

-- =====================================================================
-- Verify:
--   select count(*) from public.admin_access_audit_log;
--   select id, public from storage.buckets where id = 'lesson-videos';
-- =====================================================================
