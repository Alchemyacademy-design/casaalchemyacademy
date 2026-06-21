-- =====================================================================
-- Designated platform admin: contact@casaalchemystudio.com
-- Apply via Supabase SQL Editor (Phase 20 — no automatic deploy).
-- Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Trigger: ensure designated admin always has the admin role
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

-- Backfill
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(trim(u.email)) = 'contact@casaalchemystudio.com'
on conflict (user_id, role) do nothing;

-- 2. Protect designated admin role from removal/demotion
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

-- 3. Admin audit log
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

-- writes only via service_role (edge functions); no insert/update/delete policy for authenticated
