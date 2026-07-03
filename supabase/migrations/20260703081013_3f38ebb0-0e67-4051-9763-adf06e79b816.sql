
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS verification_hash TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pdf_cached_path TEXT;

-- Backfill slug + hash for existing rows
UPDATE public.certificates
SET public_slug = 'aa-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE public_slug IS NULL;

UPDATE public.certificates
SET verification_hash = encode(
  digest(certificate_number || '|' || user_id::text || '|' || course_id::text || '|' || issued_at::text, 'sha256'),
  'hex'
)
WHERE verification_hash IS NULL;

-- Auto-populate slug + hash on future inserts
CREATE OR REPLACE FUNCTION public.certificates_populate_public_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.public_slug IS NULL THEN
    NEW.public_slug := 'aa-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  IF NEW.verification_hash IS NULL THEN
    NEW.verification_hash := encode(
      digest(NEW.certificate_number || '|' || NEW.user_id::text || '|' || NEW.course_id::text || '|' || NEW.issued_at::text, 'sha256'),
      'hex'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certificates_populate_public_fields ON public.certificates;
CREATE TRIGGER trg_certificates_populate_public_fields
BEFORE INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.certificates_populate_public_fields();

-- Public verification RPC (safe fields only, filters revoked)
CREATE OR REPLACE FUNCTION public.get_public_certificate(slug text)
RETURNS TABLE(
  public_slug text,
  certificate_number text,
  issued_at timestamptz,
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
    c.public_slug,
    c.certificate_number,
    c.issued_at,
    COALESCE(p.display_name, p.full_name, 'Alchemist') AS student_name,
    COALESCE(co.title, (c.metadata->>'course_title'), 'Course') AS course_title,
    c.verification_hash
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  WHERE c.public_slug = slug
    AND c.revoked_at IS NULL
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_certificate(text) TO anon, authenticated;
