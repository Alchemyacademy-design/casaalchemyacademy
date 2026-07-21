-- Leads table for lead-magnet pop-up and course-recommendation quiz.
-- Public inserts (anon) allowed; reads/updates/deletes restricted to admins.

CREATE TYPE public.lead_source AS ENUM ('popup', 'quiz');

CREATE TABLE public.leads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  source public.lead_source NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  user_agent TEXT,
  hubspot_contact_id TEXT,
  hubspot_synced_at TIMESTAMPTZ,
  hubspot_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_email_length CHECK (char_length(email) BETWEEN 3 AND 320),
  CONSTRAINT leads_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT leads_phone_length CHECK (char_length(phone) BETWEEN 4 AND 40)
);

-- Deduplicate by (email + source) so replayed submits update the same row.
CREATE UNIQUE INDEX leads_email_source_key
  ON public.leads (lower(email), source);
CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);

GRANT INSERT, UPDATE ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors can submit new leads and update their own submission
-- (to power upsert-on-conflict from the edge function without service role).
-- They CANNOT read leads back.
CREATE POLICY "Anyone can submit a lead"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update lead by email (upsert)"
  ON public.leads FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can read all leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER leads_touch_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();