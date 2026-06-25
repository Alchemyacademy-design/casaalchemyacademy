-- 20260625120000 — Secure quizzes (no client is_correct), transactional grading
-- RPC, and module_ratings + summary with access-gated writes.
--
-- INTENDED FINAL PATH: supabase/migrations/20260625120000_secure_quiz_and_module_ratings.sql
-- Lovable's migration runner refuses direct file writes there, so this file
-- is the source of truth. Apply it via the Supabase SQL Editor after external
-- review. Once applied, the runner will record it like any other migration.
--
-- This file SUPERSEDES the earlier docs/migrations/20260625000000_*.sql draft.
--
-- Rollback (DDL only):
--   - DROP FUNCTION public.internal_submit_quiz_attempt(uuid, bigint, jsonb);
--   - DROP FUNCTION public.module_rating_summary(bigint);
--   - DROP FUNCTION public.can_access_module(bigint);
--   - DROP TABLE public.module_ratings;
--   - Re-grant SELECT on public.quiz_options to authenticated, anon if a
--     downgrade requires it (NOT recommended — would re-expose the answer key).
--
-- ROLLBACK DATA SAFETY:
--   - Safe with zero data loss ONLY while public.module_ratings has no rows
--     (i.e. before any member submits a rating).
--   - After the first rating is inserted, DROP TABLE destroys all ratings;
--     a downgrade then REQUIRES a prior `pg_dump`/CSV export of
--     public.module_ratings, restored after re-creation.
--   - public.internal_submit_quiz_attempt / public.module_rating_summary /
--     public.can_access_module are pure functions — dropping them never
--     destroys data.
--
-- The entire migration is wrapped in a single explicit transaction so a
-- failure in any block leaves the database unchanged. Do NOT remove the
-- BEGIN/COMMIT envelope when running it through the SQL Editor.

begin;

-- =====================================================================
-- 1) Lock down quiz_options so the answer key is unreadable from the browser
-- =====================================================================

-- Revoke table-level SELECT entirely. The member path now goes through
-- the get-member-quiz edge function (service-role).
revoke select on table public.quiz_options from authenticated;
revoke select on table public.quiz_options from anon;
revoke select (is_correct) on public.quiz_options from authenticated;
revoke select (is_correct) on public.quiz_options from anon;

-- service_role keeps full access (get-member-quiz, get-admin-quiz, submit-quiz-attempt).
grant all on public.quiz_options to service_role;

-- Drop any RLS policies that allowed direct member SELECT on quiz_options.
-- Admin-only INSERT/UPDATE/DELETE policies remain unchanged.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'quiz_options' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.quiz_options', pol.policyname);
  end loop;
end$$;

-- =====================================================================
-- 2) Transactional grading RPC
-- =====================================================================

create or replace function public.internal_submit_quiz_attempt(
  p_user_id uuid,
  p_quiz_id bigint,
  p_answers jsonb
)
returns table(score integer, passed boolean, attempts_remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz record;
  v_is_admin boolean;
  v_has_access boolean;
  v_now timestamptz := now();
  v_total_points integer := 0;
  v_earned_points integer := 0;
  v_score integer := 0;
  v_passed boolean := false;
  v_submitted_count integer := 0;
  v_attempt_id bigint;
  v_remaining integer;
  v_answer jsonb;
  v_qid bigint;
  v_oid bigint;
  v_seen bigint[] := array[]::bigint[];
  v_expected_q bigint[];
  v_provided_q bigint[];
begin
  if p_user_id is null then raise exception 'unauthorized'; end if;
  if p_quiz_id is null then raise exception 'invalid_quiz_ref'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'invalid_answers';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_quiz_id::text, 0)
  );

  select id, course_id, status, passing_score, max_attempts
    into v_quiz
  from public.quizzes
  where id = p_quiz_id;

  if not found or v_quiz.status <> 'published' then
    raise exception 'quiz_unavailable';
  end if;

  v_is_admin := exists(
    select 1 from public.user_roles where user_id = p_user_id and role = 'admin'
  );
  if v_is_admin then
    raise exception 'admin_preview_blocked';
  end if;

  v_has_access := exists(
    select 1 from public.memberships m
    where m.user_id = p_user_id and m.status = 'active' and m.ends_at > v_now
  ) or exists(
    select 1 from public.course_entitlements e
    where e.user_id = p_user_id
      and e.course_id = v_quiz.course_id
      and e.active = true
      and e.ends_at > v_now
  ) or exists(
    select 1 from public.courses c
    where c.id = v_quiz.course_id
      and c.archived_at is null
      and (
        coalesce(array_length(c.access_plan_keys, 1), 0) = 0
        or 'free'::text = any(c.access_plan_keys::text[])
        or 'guest'::text = any(c.access_plan_keys::text[])
      )
  );
  if not v_has_access then raise exception 'forbidden'; end if;

  if v_quiz.max_attempts is not null then
    select count(*) into v_submitted_count
    from public.quiz_attempts
    where user_id = p_user_id and quiz_id = p_quiz_id and submitted_at is not null;
    if v_submitted_count >= v_quiz.max_attempts then
      raise exception 'no_attempts_remaining';
    end if;
  end if;

  select coalesce(array_agg(id order by id), array[]::bigint[])
    into v_expected_q
  from public.quiz_questions
  where quiz_id = p_quiz_id;

  for v_answer in select * from jsonb_array_elements(p_answers) loop
    v_qid := (v_answer->>'question_id')::bigint;
    v_oid := (v_answer->>'option_id')::bigint;
    if v_qid is null or v_oid is null then raise exception 'invalid_answer_ids'; end if;
    if v_qid = any(v_seen) then raise exception 'duplicate_question'; end if;
    v_seen := array_append(v_seen, v_qid);
    if not exists(select 1 from public.quiz_questions where id = v_qid and quiz_id = p_quiz_id) then
      raise exception 'invalid_question_ref';
    end if;
    if not exists(select 1 from public.quiz_options where id = v_oid and question_id = v_qid) then
      raise exception 'invalid_option_ref';
    end if;
  end loop;

  v_provided_q := v_seen;

  if exists(select unnest(v_expected_q) except select unnest(v_provided_q)) then
    raise exception 'missing_answer';
  end if;
  if exists(select unnest(v_provided_q) except select unnest(v_expected_q)) then
    raise exception 'extra_answer';
  end if;

  insert into public.quiz_attempts(user_id, quiz_id, started_at, submitted_at, score, passed)
  values (p_user_id, p_quiz_id, v_now, v_now, 0, false)
  returning id into v_attempt_id;

  insert into public.quiz_answers(attempt_id, question_id, option_id, is_correct, points_awarded)
  select
    v_attempt_id,
    (a->>'question_id')::bigint,
    (a->>'option_id')::bigint,
    coalesce(o.is_correct, false),
    case when coalesce(o.is_correct, false) then coalesce(q.points, 1) else 0 end
  from jsonb_array_elements(p_answers) a
  join public.quiz_questions q on q.id = (a->>'question_id')::bigint
  left join public.quiz_options o on o.id = (a->>'option_id')::bigint;

  select
    coalesce(sum(coalesce(q.points, 1))::int, 0),
    coalesce(sum(case when o.is_correct then coalesce(q.points, 1) else 0 end)::int, 0)
    into v_total_points, v_earned_points
  from public.quiz_questions q
  left join jsonb_array_elements(p_answers) a on (a->>'question_id')::bigint = q.id
  left join public.quiz_options o on o.id = nullif(a->>'option_id', '')::bigint
  where q.quiz_id = p_quiz_id;

  v_score := case when v_total_points > 0
    then round((v_earned_points::numeric / v_total_points::numeric) * 100)::int
    else 0 end;
  v_passed := v_total_points > 0 and v_score >= coalesce(v_quiz.passing_score, 0);

  update public.quiz_attempts
    set score = v_score, passed = v_passed
    where id = v_attempt_id;

  v_remaining := case when v_quiz.max_attempts is null then null
    else greatest(0, v_quiz.max_attempts - (v_submitted_count + 1)) end;

  score := v_score; passed := v_passed; attempts_remaining := v_remaining;
  return next;
end;
$$;

revoke all on function public.internal_submit_quiz_attempt(uuid, bigint, jsonb) from public;
grant execute on function public.internal_submit_quiz_attempt(uuid, bigint, jsonb) to service_role;

-- =====================================================================
-- 3) module_ratings — with access-gated writes
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

-- can_access_module ALWAYS uses auth.uid() — no caller-supplied user id, so
-- one authenticated user cannot probe another user's access state.
create or replace function public.can_access_module(_module_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with m as (
    select cm.id as module_id, cm.archived_at, c.id as course_id,
           c.archived_at as course_archived_at, c.access_plan_keys
    from public.course_modules cm
    join public.courses c on c.id = cm.course_id
    where cm.id = _module_id
  )
  select auth.uid() is not null
    and exists(select 1 from m where module_id is not null and archived_at is null and course_archived_at is null)
    and (
      exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
      or exists(
        select 1 from public.memberships
        where user_id = auth.uid() and status = 'active' and ends_at > now()
      )
      or exists(
        select 1 from m
        join public.course_entitlements e on e.course_id = m.course_id
        where e.user_id = auth.uid() and e.active = true and e.ends_at > now()
      )
      or exists(
        select 1 from m
        where coalesce(array_length(m.access_plan_keys, 1), 0) = 0
          or 'free'::text = any(m.access_plan_keys::text[])
          or 'guest'::text = any(m.access_plan_keys::text[])
      )
    );
$$;
revoke all on function public.can_access_module(bigint) from public;
grant execute on function public.can_access_module(bigint) to authenticated, service_role;

drop policy if exists "module_ratings_select_own" on public.module_ratings;
create policy "module_ratings_select_own" on public.module_ratings
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "module_ratings_insert_own" on public.module_ratings;
create policy "module_ratings_insert_own" on public.module_ratings
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_module(module_id));

drop policy if exists "module_ratings_update_own" on public.module_ratings;
create policy "module_ratings_update_own" on public.module_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_module(module_id));

drop policy if exists "module_ratings_delete_own" on public.module_ratings;
create policy "module_ratings_delete_own" on public.module_ratings
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.touch_module_ratings_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists module_ratings_set_updated_at on public.module_ratings;
create trigger module_ratings_set_updated_at
  before update on public.module_ratings
  for each row execute function public.touch_module_ratings_updated_at();

-- module_rating_summary returns the average, total count, AND the caller's
-- own rating (null when the caller has not rated yet).
create or replace function public.module_rating_summary(p_module_id bigint)
returns table(avg_rating numeric, total integer, user_rating smallint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not public.can_access_module(p_module_id) then
    raise exception 'forbidden';
  end if;
  return query
    select
      coalesce(avg(r.rating)::numeric(3,2), 0)::numeric,
      count(*)::int,
      (select mr.rating from public.module_ratings mr
        where mr.module_id = p_module_id and mr.user_id = auth.uid())
    from public.module_ratings r
    where r.module_id = p_module_id;
end;
$$;

revoke all on function public.module_rating_summary(bigint) from public;
grant execute on function public.module_rating_summary(bigint) to authenticated;
-- anon is intentionally NOT granted.

commit;

-- anon is intentionally NOT granted.
