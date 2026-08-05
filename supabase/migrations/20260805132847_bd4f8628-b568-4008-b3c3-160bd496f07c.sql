CREATE OR REPLACE FUNCTION public.get_public_course_catalog()
RETURNS TABLE(
  id bigint,
  title text,
  subtitle text,
  short_description text,
  description text,
  cover_image_path text,
  banner_url text,
  sort_order integer,
  lesson_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select
    c.id,
    c.title,
    c.subtitle,
    c.short_description,
    c.description,
    c.cover_image_path,
    c.banner_url,
    c.sort_order,
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
  where c.status = 'published'
    and c.archived_at is null
    and c.visibility = 'public'
  order by c.sort_order asc, c.id asc
$$;

REVOKE ALL ON FUNCTION public.get_public_course_catalog() FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_course_catalog() TO anon, authenticated, service_role;