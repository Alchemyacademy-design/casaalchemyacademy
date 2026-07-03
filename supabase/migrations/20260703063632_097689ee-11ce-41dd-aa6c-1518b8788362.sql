
ALTER TABLE public.lesson_progress
  ADD COLUMN IF NOT EXISTS last_position_seconds integer;

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  position_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes read" ON public.lesson_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notes write" ON public.lesson_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes update" ON public.lesson_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes delete" ON public.lesson_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_lesson_notes_touch BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.community_reads (
  user_id uuid NOT NULL,
  channel_id bigint NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_reads TO authenticated;
GRANT ALL ON public.community_reads TO service_role;
ALTER TABLE public.community_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads read" ON public.community_reads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own reads upsert" ON public.community_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reads update" ON public.community_reads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.deal_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  deal_id bigint NOT NULL REFERENCES public.exclusive_deals(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  referrer text
);
GRANT SELECT, INSERT ON public.deal_clicks TO authenticated;
GRANT ALL ON public.deal_clicks TO service_role;
ALTER TABLE public.deal_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clicks insert" ON public.deal_clicks FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "admin reads clicks" ON public.deal_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS deal_clicks_deal_idx ON public.deal_clicks (deal_id, clicked_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
