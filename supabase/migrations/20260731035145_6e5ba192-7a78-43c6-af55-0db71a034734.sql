create or replace function public.get_purchasable_courses()
returns table (
  id bigint,
  title text,
  subtitle text,
  short_description text,
  description text,
  cover_image_path text,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.title, c.subtitle, c.short_description, c.description, c.cover_image_path, c.sort_order
  from public.courses c
  where c.status = 'published'
    and c.archived_at is null
    and c.visibility = 'public'
  order by c.sort_order asc, c.id asc
$$;

revoke all on function public.get_purchasable_courses() from public;
grant execute on function public.get_purchasable_courses() to anon, authenticated;