
-- Extend profiles with birthdate, profession, region, bio
alter table public.profiles
  add column if not exists birthdate date,
  add column if not exists profession text,
  add column if not exists region text,
  add column if not exists bio text;

-- Server-side validation for the new fields
create or replace function public.profiles_validate_extended()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.bio is not null and length(new.bio) > 600 then
    raise exception 'bio too long (max 600 characters)';
  end if;
  if new.profession is not null and length(new.profession) > 120 then
    raise exception 'profession too long (max 120 characters)';
  end if;
  if new.region is not null and length(new.region) > 120 then
    raise exception 'region too long (max 120 characters)';
  end if;
  if new.birthdate is not null and (new.birthdate > current_date or new.birthdate < '1900-01-01'::date) then
    raise exception 'invalid birthdate';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_validate_extended_trg on public.profiles;
create trigger profiles_validate_extended_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_validate_extended();

-- Public-safe profile fetcher (used by community/leaderboard cards)
-- Returns only non-sensitive fields; email/timezone/prefs stay behind RLS.
create or replace function public.get_public_profiles(_ids uuid[])
returns table(
  id uuid,
  display_name text,
  full_name text,
  avatar_path text,
  bio text,
  profession text,
  region text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.full_name, p.avatar_path, p.bio, p.profession, p.region
  from public.profiles p
  where auth.uid() is not null
    and p.id = any(_ids);
$$;

grant execute on function public.get_public_profiles(uuid[]) to authenticated;
