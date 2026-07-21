ALTER TABLE public.live_workshops
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_html_link text,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_status text,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_error text;

CREATE INDEX IF NOT EXISTS live_workshops_gcal_status_idx
  ON public.live_workshops (google_calendar_sync_status)
  WHERE google_calendar_sync_status IS NOT NULL;