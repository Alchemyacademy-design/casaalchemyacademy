
-- Phase 1 preparation columns for user-level Google Calendar sync (implementation deferred).
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS user_google_calendar_event_id text,
  ADD COLUMN IF NOT EXISTS user_google_calendar_html_link text,
  ADD COLUMN IF NOT EXISTS user_google_calendar_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_google_calendar_sync_status text NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS user_google_calendar_sync_error text;

CREATE INDEX IF NOT EXISTS registrations_user_gcal_status_idx
  ON public.registrations(user_google_calendar_sync_status)
  WHERE user_google_calendar_sync_status IN ('pending','failed');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_auto_add_enabled boolean NOT NULL DEFAULT false;
