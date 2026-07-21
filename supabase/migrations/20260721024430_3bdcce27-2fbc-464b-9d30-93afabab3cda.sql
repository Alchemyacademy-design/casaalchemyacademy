ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_html_link text,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_status text NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS google_calendar_sync_error text;

COMMENT ON COLUMN public.events.google_calendar_sync_status IS 'not_synced | pending | synced | failed | deleted';

CREATE INDEX IF NOT EXISTS events_gcal_event_id_idx ON public.events (google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;