ALTER TABLE public.deal_terms_acceptances
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE INDEX IF NOT EXISTS deal_terms_acceptances_email_slug_idx
  ON public.deal_terms_acceptances (lower(email), deal_slug);

ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'casa_consult';

CREATE OR REPLACE FUNCTION public.deal_booking_status(p_deal_slug text, p_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_accepted_at timestamptz;
  v_terms_version text;
  v_paid_at timestamptz;
  v_target uuid;
BEGIN
  SELECT a.accepted_at, a.terms_version
    INTO v_accepted_at, v_terms_version
  FROM public.deal_terms_acceptances a
  WHERE a.deal_slug = p_deal_slug
    AND (
      (v_uid IS NOT NULL AND a.user_id = v_uid)
      OR (v_email IS NOT NULL AND lower(a.email) = v_email)
    )
  ORDER BY a.accepted_at DESC
  LIMIT 1;

  v_target := v_uid;
  IF v_target IS NULL AND v_email IS NOT NULL THEN
    SELECT p.id INTO v_target FROM public.profiles p WHERE lower(p.email) = v_email LIMIT 1;
  END IF;

  IF v_accepted_at IS NOT NULL AND v_target IS NOT NULL THEN
    SELECT sp.paid_at INTO v_paid_at
    FROM public.stripe_payments sp
    WHERE sp.user_id = v_target
      AND sp.status = 'paid'
      AND sp.paid_at IS NOT NULL
      AND sp.paid_at >= v_accepted_at - interval '1 day'
      AND (
        sp.metadata->>'deal_slug' = p_deal_slug
        OR sp.amount IN (29500, 39500)
      )
    ORDER BY sp.paid_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'terms_accepted', v_accepted_at IS NOT NULL,
    'accepted_at', v_accepted_at,
    'terms_version', v_terms_version,
    'payment_verified', v_paid_at IS NOT NULL,
    'paid_at', v_paid_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deal_booking_status(text, text) TO anon, authenticated;