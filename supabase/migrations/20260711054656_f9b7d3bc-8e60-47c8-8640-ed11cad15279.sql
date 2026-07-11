CREATE OR REPLACE FUNCTION public.get_public_certificate_status(slug text)
RETURNS TABLE(
  status text,
  public_slug text,
  certificate_number text,
  issued_at timestamptz,
  revoked_at timestamptz,
  student_name text,
  course_title text,
  verification_hash text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN c.revoked_at IS NOT NULL THEN 'revoked' ELSE 'ok' END AS status,
    c.public_slug,
    c.certificate_number,
    c.issued_at,
    c.revoked_at,
    COALESCE(p.display_name, p.full_name, 'Alchemist') AS student_name,
    COALESCE(co.title, (c.metadata->>'course_title'), 'Course') AS course_title,
    c.verification_hash
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  WHERE c.public_slug = slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_certificate_status(text) TO anon, authenticated;