
-- 1. certificates: allow program-wide certificates (no course)
ALTER TABLE public.certificates ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS certificate_type text NOT NULL DEFAULT 'course';
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_certificate_type_check;
ALTER TABLE public.certificates ADD CONSTRAINT certificates_certificate_type_check
  CHECK (certificate_type IN ('course', 'program'));
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_type_course_consistency;
ALTER TABLE public.certificates ADD CONSTRAINT certificates_type_course_consistency
  CHECK (
    (certificate_type = 'course' AND course_id IS NOT NULL)
    OR (certificate_type = 'program' AND course_id IS NULL)
  );

-- 2. certificate_views
CREATE TABLE IF NOT EXISTS public.certificate_views (
  id BIGSERIAL PRIMARY KEY,
  certificate_id BIGINT NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS certificate_views_certificate_id_idx
  ON public.certificate_views(certificate_id);
CREATE INDEX IF NOT EXISTS certificate_views_viewed_at_idx
  ON public.certificate_views(viewed_at DESC);

GRANT SELECT ON public.certificate_views TO authenticated;
GRANT ALL ON public.certificate_views TO service_role;

ALTER TABLE public.certificate_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificate_views_admin_read ON public.certificate_views;
CREATE POLICY certificate_views_admin_read
  ON public.certificate_views
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. public RPC to record a view (SECURITY DEFINER, callable by anon)
CREATE OR REPLACE FUNCTION public.record_certificate_view(
  slug text,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert_id bigint;
BEGIN
  IF slug IS NULL OR length(btrim(slug)) = 0 THEN
    RETURN false;
  END IF;

  SELECT id INTO v_cert_id
  FROM public.certificates
  WHERE public_slug = slug
    AND revoked_at IS NULL
  LIMIT 1;

  IF v_cert_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.certificate_views(certificate_id, user_agent, referrer)
  VALUES (
    v_cert_id,
    NULLIF(left(coalesce(p_user_agent, ''), 500), ''),
    NULLIF(left(coalesce(p_referrer, ''), 500), '')
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_certificate_view(text, text, text) TO anon, authenticated;

-- 4. Update public certificate RPCs to handle program certificates gracefully
CREATE OR REPLACE FUNCTION public.get_public_certificate_status(slug text)
 RETURNS TABLE(status text, public_slug text, certificate_number text, issued_at timestamp with time zone, revoked_at timestamp with time zone, student_name text, course_title text, verification_hash text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE WHEN c.revoked_at IS NOT NULL THEN 'revoked' ELSE 'ok' END AS status,
    c.public_slug,
    c.certificate_number,
    c.issued_at,
    c.revoked_at,
    COALESCE(p.display_name, p.full_name, 'Alchemist') AS student_name,
    CASE
      WHEN c.certificate_type = 'program' THEN COALESCE((c.metadata->>'course_title'), 'Alchemy Academy — Method Completion')
      ELSE COALESCE(co.title, (c.metadata->>'course_title'), 'Course')
    END AS course_title,
    c.verification_hash
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  WHERE c.public_slug = slug
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_certificate(slug text)
 RETURNS TABLE(public_slug text, certificate_number text, issued_at timestamp with time zone, student_name text, course_title text, verification_hash text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.public_slug,
    c.certificate_number,
    c.issued_at,
    COALESCE(p.display_name, p.full_name, 'Alchemist') AS student_name,
    CASE
      WHEN c.certificate_type = 'program' THEN COALESCE((c.metadata->>'course_title'), 'Alchemy Academy — Method Completion')
      ELSE COALESCE(co.title, (c.metadata->>'course_title'), 'Course')
    END AS course_title,
    c.verification_hash
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  WHERE c.public_slug = slug
    AND c.revoked_at IS NULL
  LIMIT 1;
$function$;
