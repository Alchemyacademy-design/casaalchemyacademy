create or replace function public.get_public_workshop(p_slug text)
returns table (
  id bigint,
  slug text,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  cover_image_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.slug, w.title, w.description, w.starts_at, w.ends_at, w.cover_image_path
  from public.live_workshops w
  where w.slug = p_slug
    and w.status = 'published'
    and w.archived_at is null
  limit 1
$$;

revoke all on function public.get_public_workshop(text) from public;
grant execute on function public.get_public_workshop(text) to anon, authenticated, service_role;