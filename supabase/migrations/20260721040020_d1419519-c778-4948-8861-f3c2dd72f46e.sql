
-- Ensure DELETE/UPDATE payloads include the old row so the admin calendar can
-- deduplicate and remove items when they change status or are archived.
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.live_workshops REPLICA IDENTITY FULL;

-- Add both tables to the Supabase Realtime publication (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_workshops'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_workshops';
  END IF;
END $$;
