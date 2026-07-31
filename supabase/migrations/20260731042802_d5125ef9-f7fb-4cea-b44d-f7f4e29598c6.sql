
-- Server-authoritative certificate eligibility + issuance.

create or replace function public.certificate_eligibility_for(_user_id uuid, _course_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_total_lessons int := 0;
  v_completed int := 0;
  v_quizzes int := 0;
  v_passed int := 0;
  v_completion int := 0;
begin
  select count(*)::int into v_total_lessons
  from public.lessons l
  join public.course_modules m on m.id = l.module_id
  where m.course_id = _course_id
    and m.status = 'published' and m.archived_at is null
    and l.status = 'published' and l.archived_at is null;

  if v_total_lessons > 0 then
    select count(*)::int into v_completed
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    join public.course_modules m on m.id = l.module_id
    where lp.user_id = _user_id
      and lp.completed_at is not null
      and m.course_id = _course_id
      and m.status = 'published' and m.archived_at is null
      and l.status = 'published' and l.archived_at is null;
    v_completion := least(100, round((v_completed::numeric / v_total_lessons::numeric) * 100)::int);
  end if;

  select count(*)::int into v_quizzes
  from public.quizzes q
  where q.course_id = _course_id and q.status = 'published';

  if v_quizzes > 0 then
    select count(distinct qa.quiz_id)::int into v_passed
    from public.quiz_attempts qa
    join public.quizzes q on q.id = qa.quiz_id
    where qa.user_id = _user_id
      and qa.passed = true
      and qa.submitted_at is not null
      and q.course_id = _course_id
      and q.status = 'published';
  end if;

  return jsonb_build_object(
    'eligible', (v_total_lessons > 0 and v_completion = 100 and v_passed = v_quizzes),
    'completion', v_completion,
    'total_lessons', v_total_lessons,
    'completed_lessons', v_completed,
    'total_quizzes', v_quizzes,
    'passed_quizzes', v_passed
  );
end;
$$;

revoke all on function public.certificate_eligibility_for(uuid, bigint) from public, anon, authenticated;

create or replace function public.my_certificate_status(p_course_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_elig jsonb;
  v_cert public.certificates%rowtype;
  v_missing text[] := array[]::text[];
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if p_course_id is null or p_course_id <= 0 then raise exception 'invalid_course_id'; end if;

  v_elig := public.certificate_eligibility_for(v_uid, p_course_id);

  select * into v_cert
  from public.certificates
  where user_id = v_uid and course_id = p_course_id and revoked_at is null
  limit 1;

  if (v_elig->>'total_lessons')::int = 0 then
    v_missing := array_append(v_missing, 'This course has no published lessons yet.');
  end if;
  if (v_elig->>'completion')::int < 100 then
    v_missing := array_append(v_missing, format('Complete all lessons (currently %s%%).', v_elig->>'completion'));
  end if;
  if (v_elig->>'total_quizzes')::int > 0
     and (v_elig->>'passed_quizzes')::int < (v_elig->>'total_quizzes')::int then
    v_missing := array_append(v_missing, format('Pass all required quizzes (%s/%s).',
      v_elig->>'passed_quizzes', v_elig->>'total_quizzes'));
  end if;

  return v_elig
    || jsonb_build_object(
      'course_id', p_course_id,
      'status', case when v_cert.id is not null then 'issued' else 'pending' end,
      'missing', to_jsonb(v_missing),
      'certificate', case when v_cert.id is null then null else jsonb_build_object(
        'id', v_cert.id,
        'certificate_number', v_cert.certificate_number,
        'issued_at', v_cert.issued_at,
        'public_slug', v_cert.public_slug,
        'verification_hash', v_cert.verification_hash,
        'certificate_type', v_cert.certificate_type,
        'metadata', v_cert.metadata
      ) end
    );
end;
$$;

revoke all on function public.my_certificate_status(bigint) from public, anon;
grant execute on function public.my_certificate_status(bigint) to authenticated;

-- Idempotent, race-safe issuance. Only this function may create a learner
-- certificate: the table has no self-insert policy for students.
create or replace function public.issue_my_certificate(p_course_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_elig jsonb;
  v_cert public.certificates%rowtype;
  v_course record;
  v_number text;
  v_issued timestamptz := now();
  v_slug text;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if p_course_id is null or p_course_id <= 0 then raise exception 'invalid_course_id'; end if;

  -- Serialize concurrent issuance attempts for this (user, course) pair.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':cert:' || p_course_id::text, 0));

  select * into v_cert
  from public.certificates
  where user_id = v_uid and course_id = p_course_id
  limit 1;

  if found then
    if v_cert.revoked_at is not null then
      raise exception 'certificate_revoked';
    end if;
    return public.my_certificate_status(p_course_id) || jsonb_build_object('just_issued', false);
  end if;

  select c.id, c.title into v_course
  from public.courses c
  where c.id = p_course_id and c.archived_at is null;
  if not found then raise exception 'course_not_found'; end if;

  v_elig := public.certificate_eligibility_for(v_uid, p_course_id);
  if not (v_elig->>'eligible')::boolean then
    raise exception 'not_eligible';
  end if;

  v_number := 'AA-' || to_char(v_issued, 'YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_slug := 'aa-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.certificates (
    user_id, course_id, certificate_number, issued_at, certificate_type,
    public_slug, verification_hash, metadata
  ) values (
    v_uid, p_course_id, v_number, v_issued, 'course',
    v_slug,
    encode(extensions.digest(v_number || '|' || v_uid::text || '|' || p_course_id::text || '|' || v_issued::text, 'sha256'), 'hex'),
    jsonb_build_object(
      'course_title', v_course.title,
      'completion_percentage', (v_elig->>'completion')::int,
      'quiz_requirements', jsonb_build_object(
        'published', (v_elig->>'total_quizzes')::int,
        'passed', (v_elig->>'passed_quizzes')::int
      ),
      'issued_rule_version', 'server.auto.v1'
    )
  )
  on conflict (user_id, course_id) do nothing;

  return public.my_certificate_status(p_course_id) || jsonb_build_object('just_issued', true);
end;
$$;

revoke all on function public.issue_my_certificate(bigint) from public, anon;
grant execute on function public.issue_my_certificate(bigint) to authenticated;

-- Overview across every published course the learner can access.
create or replace function public.my_certificates_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;

  for r in
    select c.id, c.title, c.cover_image_path
    from public.courses c
    where c.status = 'published' and c.archived_at is null
    order by c.sort_order asc, c.id asc
  loop
    if public.can_access_course(r.id)
       or exists (select 1 from public.certificates ct where ct.user_id = v_uid and ct.course_id = r.id)
    then
      v_out := v_out || jsonb_build_array(
        public.my_certificate_status(r.id)
        || jsonb_build_object('course_title', r.title, 'cover_image_path', r.cover_image_path)
      );
    end if;
  end loop;

  return v_out;
end;
$$;

revoke all on function public.my_certificates_overview() from public, anon;
grant execute on function public.my_certificates_overview() to authenticated;
