
CREATE OR REPLACE FUNCTION public.set_certificate_visibility(p_certificate_id bigint, p_make_public boolean)
 RETURNS TABLE(id bigint, public_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_slug text;
  v_existing text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING errcode = '42501';
  END IF;

  SELECT c.user_id, c.public_slug INTO v_owner, v_existing
  FROM public.certificates c
  WHERE c.id = p_certificate_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'certificate_not_found' USING errcode = 'P0002';
  END IF;

  IF v_owner <> v_user AND NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  IF p_make_public THEN
    IF v_existing IS NULL THEN
      v_slug := 'aa-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    ELSE
      v_slug := v_existing;
    END IF;
  ELSE
    v_slug := NULL;
  END IF;

  UPDATE public.certificates
     SET public_slug = v_slug
   WHERE public.certificates.id = p_certificate_id;

  RETURN QUERY SELECT p_certificate_id, v_slug;
END;
$function$;
