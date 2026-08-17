ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'live_workshop';
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'contact';
ALTER TABLE public.leads ALTER COLUMN phone DROP NOT NULL;