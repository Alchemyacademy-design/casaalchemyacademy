-- 20260625000000 — Secure quiz_options.is_correct + create module_ratings
--
-- This migration must be applied via the Supabase SQL Editor.
-- It does TWO things:
--   1) Removes member-facing access to quiz_options.is_correct so the answer
--      key cannot be read from the browser. Member quiz UI keeps reading the
--      safe columns (id, question_id, option_text, sort_order). The admin role
--      keeps full read via existing has_role policies.
--   2) Creates public.module_ratings backing the post-quiz "Rate this module"
--      experience required by the Courses documentation.
--
-- Safety notes:
--   - is_correct stays in the table; only column-level SELECT is revoked from
--     authenticated and anon. The submit-quiz-attempt edge function reads it
--     via service_role.
--   - module_ratings exposes only own-row reads to authenticated; aggregates
--     are served by a SECURITY DEFINER function so members never read other
--     users' ratings.

-- =====================================================================
-- 1) Lock down quiz_options.is_correct
-- =====================================================================

revoke select (is_correct) on public.quiz_options from authenticated;
revoke select (is_correct) on public.quiz_options from anon;

-- Re-state safe column grants so explicit privileges remain after the revoke.
grant select (id, question_id, option_text, sort_order) on public.quiz_options to authenticated;
grant select (id, question_id, option_text, sort_order) on public.quiz_options to anon;

-- service_role keeps full access (used by submit-quiz-attempt).
grant all on public.quiz_options to service_role;

-- =====================================================================
-- 2) module_ratings
-- =====================================================================

create table if not exists public.module_ratings (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id bigint not null references public.course_modules(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

grant select, insert, update, delete on public.module_ratings to authenticated;
grant all on public.module_ratings to service_role;

alter table public.module_ratings enable row level security;

drop policy if exists "module_ratings_select_own" on public.module_ratings;
create policy "module_ratings_select_own" on public.module_ratings
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "module_ratings_insert_own" on public.module_ratings;
create policy "module_ratings_insert_own" on public.module_ratings
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "module_ratings_update_own" on public.module_ratings;
create policy "module_ratings_update_own" on public.module_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "module_ratings_delete_own" on public.module_ratings;
create policy "module_ratings_delete_own" on public.module_ratings
  for delete to authenticated
  using (user_id = auth.uid());

-- updated_at trigger
create or replace function public.touch_module_ratings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists module_ratings_set_updated_at on public.module_ratings;
create trigger module_ratings_set_updated_at
  before update on public.module_ratings
  for each row execute function public.touch_module_ratings_updated_at();

-- Aggregate function — members never need to SELECT other users' rows.
create or replace function public.module_rating_summary(p_module_id bigint)
returns table(avg_rating numeric, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(avg(rating)::numeric(3,2), 0) as avg_rating,
    count(*)::int as total
  from public.module_ratings
  where module_id = p_module_id;
$$;

grant execute on function public.module_rating_summary(bigint) to authenticated, anon;
