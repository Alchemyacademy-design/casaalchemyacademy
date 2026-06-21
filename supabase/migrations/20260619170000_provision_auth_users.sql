create or replace function private.provision_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  requested_full_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    display_name,
    timezone
  ) values (
    new.id,
    nullif(normalized_email, ''),
    requested_full_name,
    requested_full_name,
    'Australia/Sydney'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        timezone = coalesce(public.profiles.timezone, excluded.timezone),
        updated_at = now();

  insert into public.user_roles (user_id, role, assigned_by)
  values (new.id, 'student'::public.app_role, null)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke all on function private.provision_auth_user_profile() from public, anon, authenticated;

create or replace trigger on_auth_user_provision_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function private.provision_auth_user_profile();

insert into public.profiles (id, email, full_name, display_name, timezone)
select
  users.id,
  nullif(lower(trim(coalesce(users.email, ''))), ''),
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), ''),
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), ''),
  'Australia/Sydney'
from auth.users as users
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      timezone = coalesce(public.profiles.timezone, excluded.timezone),
      updated_at = now();

insert into public.user_roles (user_id, role, assigned_by)
select users.id, 'student'::public.app_role, null
from auth.users as users
on conflict (user_id, role) do nothing;

