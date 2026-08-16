update public.courses
set cover_image_path = '/__l5e/assets-v1/f7ae33b1-b07a-4ca9-ad52-91714d725a44/elemental-bathroom.png'
where id = 4;

create or replace function public.get_public_course_teasers()
returns table(id bigint, title text, subtitle text, short_description text, description text, cover_image_path text, banner_url text, sort_order integer, status text, lesson_count integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    c.id,
    c.title,
    c.subtitle,
    c.short_description,
    c.description,
    c.cover_image_path,
    c.banner_url,
    c.sort_order,
    c.status::text,
    (
      select count(*)::int
      from public.course_modules m
      join public.lessons l on l.module_id = m.id
      where m.course_id = c.id
        and m.archived_at is null
        and m.status = 'published'
        and l.archived_at is null
        and l.status = 'published'
    ) as lesson_count
  from public.courses c
  where c.archived_at is null
    and c.visibility = 'public'
  order by c.sort_order asc, c.id asc
$function$;

revoke all on function public.get_public_course_teasers() from public;
grant execute on function public.get_public_course_teasers() to anon, authenticated, service_role;