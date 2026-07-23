
-- Remove user-facing Google Calendar OAuth integration.
-- Keeps admin-owned sync (events/live_workshops <-> admin Google Calendar) intact.

DROP TABLE IF EXISTS public.google_calendar_connections CASCADE;
DROP TABLE IF EXISTS public.google_calendar_oauth_states CASCADE;
DROP FUNCTION IF EXISTS public.gcal_touch_updated_at() CASCADE;

ALTER TABLE public.registrations
  DROP COLUMN IF EXISTS user_google_calendar_event_id,
  DROP COLUMN IF EXISTS user_google_calendar_html_link,
  DROP COLUMN IF EXISTS user_google_calendar_synced_at,
  DROP COLUMN IF EXISTS user_google_calendar_sync_status,
  DROP COLUMN IF EXISTS user_google_calendar_sync_error;
