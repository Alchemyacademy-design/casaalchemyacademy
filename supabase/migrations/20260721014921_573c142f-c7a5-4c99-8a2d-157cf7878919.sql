
CREATE TABLE public.channel_follows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id bigint NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

GRANT SELECT, INSERT, DELETE ON public.channel_follows TO authenticated;
GRANT ALL ON public.channel_follows TO service_role;

ALTER TABLE public.channel_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own follows"
  ON public.channel_follows FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own follows"
  ON public.channel_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own follows"
  ON public.channel_follows FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_channel_follows_channel ON public.channel_follows(channel_id);

CREATE OR REPLACE FUNCTION public.notify_channel_followers_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_channel_name text;
  v_channel_slug text;
  v_space_slug text;
  v_space_id bigint;
BEGIN
  IF NEW.status::text <> 'published' THEN RETURN NEW; END IF;
  IF NEW.hidden_at IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT c.name, c.slug, c.space_id
    INTO v_channel_name, v_channel_slug, v_space_id
  FROM public.community_channels c WHERE c.id = NEW.channel_id;

  IF v_channel_name IS NULL THEN RETURN NEW; END IF;

  SELECT slug INTO v_space_slug FROM public.community_spaces WHERE id = v_space_id;

  INSERT INTO public.notifications(user_id, kind, title, body, href, data)
  SELECT
    f.user_id,
    'channel_post',
    'New post in #' || v_channel_name,
    COALESCE(NULLIF(NEW.title, ''), left(NEW.body, 140)),
    '/community?space=' || COALESCE(v_space_slug, '') || '&channel=' || v_channel_slug,
    jsonb_build_object('post_id', NEW.id, 'channel_id', NEW.channel_id, 'author_id', NEW.author_id)
  FROM public.channel_follows f
  WHERE f.channel_id = NEW.channel_id
    AND f.user_id <> NEW.author_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_channel_followers ON public.community_posts;
CREATE TRIGGER trg_notify_channel_followers
AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_channel_followers_on_post();
