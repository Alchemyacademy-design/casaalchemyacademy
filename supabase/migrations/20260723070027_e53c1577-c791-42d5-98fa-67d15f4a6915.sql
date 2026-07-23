-- Normalize existing emails to lowercase, drop expression index, add proper unique constraint on (email, source) so PostgREST on_conflict works.
UPDATE public.leads SET email = lower(email) WHERE email <> lower(email);
DROP INDEX IF EXISTS public.leads_email_source_key;
ALTER TABLE public.leads ADD CONSTRAINT leads_email_source_key UNIQUE (email, source);