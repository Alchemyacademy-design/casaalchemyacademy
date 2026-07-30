-- 1) can_access_course
create or replace function public.can_access_course(_course_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select auth.uid() is not null
    and exists (select 1 from public.courses c where c.id = _course_id and c.archived_at is null)
    and (
      exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
      or exists(select 1 from public.memberships where user_id = auth.uid() and status = 'active' and ends_at > now())
      or exists(select 1 from public.course_entitlements e where e.course_id = _course_id and e.user_id = auth.uid() and e.active = true and e.ends_at > now())
      or exists(
        select 1 from public.courses c
        where c.id = _course_id
          and (coalesce(array_length(c.access_plan_keys, 1), 0) = 0
               or 'free'::text = any(c.access_plan_keys::text[])
               or 'guest'::text = any(c.access_plan_keys::text[]))
      )
    );
$$;

revoke all on function public.can_access_course(bigint) from public, anon;
grant execute on function public.can_access_course(bigint) to authenticated, service_role;

-- 2) schema changes
alter table public.lesson_attachments
  alter column lesson_id drop not null,
  alter column storage_path drop not null,
  add column if not exists course_id bigint references public.courses(id) on delete cascade,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists external_url text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

update public.lesson_attachments set title = coalesce(title, file_name);

alter table public.lesson_attachments
  drop constraint if exists lesson_attachments_scope_chk,
  drop constraint if exists lesson_attachments_source_chk;

alter table public.lesson_attachments
  add constraint lesson_attachments_scope_chk check (num_nonnulls(lesson_id, course_id) = 1),
  add constraint lesson_attachments_source_chk check (storage_path is not null or external_url is not null);

create index if not exists lesson_attachments_course_idx on public.lesson_attachments(course_id);

drop trigger if exists touch_lesson_attachments_updated_at on public.lesson_attachments;
create trigger touch_lesson_attachments_updated_at
  before update on public.lesson_attachments
  for each row execute function public.touch_updated_at();

-- 3) policies
drop policy if exists lesson_attachments_admin_all on public.lesson_attachments;
create policy lesson_attachments_admin_all on public.lesson_attachments
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'content_manager'::app_role))
  with check (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'content_manager'::app_role));

drop policy if exists lesson_attachments_instructor_all on public.lesson_attachments;
create policy lesson_attachments_instructor_all on public.lesson_attachments
  for all to authenticated
  using (
    public.has_role(auth.uid(),'instructor'::app_role)
    and ((lesson_id is not null and public.owns_lesson(lesson_id))
         or (course_id is not null and public.owns_course(course_id)))
  )
  with check (
    public.has_role(auth.uid(),'instructor'::app_role)
    and ((lesson_id is not null and public.owns_lesson(lesson_id))
         or (course_id is not null and public.owns_course(course_id)))
  );

drop policy if exists lesson_attachments_learner_read on public.lesson_attachments;
create policy lesson_attachments_learner_read on public.lesson_attachments
  for select to authenticated
  using (
    (lesson_id is not null and public.can_access_lesson(lesson_id))
    or (course_id is not null and public.can_access_course(course_id))
  );

-- 4) storage read policy for learners on materials/ paths
drop policy if exists course_assets_materials_learner_read on storage.objects;
create policy course_assets_materials_learner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-assets'
    and name like 'materials/%'
    and exists (
      select 1 from public.lesson_attachments a
      where a.storage_bucket = 'course-assets'
        and a.storage_path = storage.objects.name
        and ((a.lesson_id is not null and public.can_access_lesson(a.lesson_id))
             or (a.course_id is not null and public.can_access_course(a.course_id)))
    )
  );