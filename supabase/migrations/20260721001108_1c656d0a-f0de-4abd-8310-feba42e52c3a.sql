DROP POLICY IF EXISTS "Anyone can update lead by email (upsert)" ON public.leads;
REVOKE UPDATE ON public.leads FROM anon;