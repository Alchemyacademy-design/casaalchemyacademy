
-- Community mentions: search RPC + notification RPC
CREATE OR REPLACE FUNCTION public.community_search_members(term text, limit_count integer DEFAULT 8)
RETURNS TABLE(id uuid, display_name text, full_name text, avatar_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.display_name, p.full_name, p.avatar_path
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND (
      term IS NULL OR length(btrim(term)) = 0
      OR p.display_name ILIKE '%' || term || '%'
      OR p.full_name ILIKE '%' || term || '%'
    )
  ORDER BY
    CASE WHEN p.display_name ILIKE term || '%' THEN 0
         WHEN p.full_name ILIKE term || '%' THEN 1
         ELSE 2 END,
    COALESCE(p.display_name, p.full_name) NULLS LAST
  LIMIT LEAST(GREATEST(limit_count, 1), 20)
$$;

GRANT EXECUTE ON FUNCTION public.community_search_members(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_notify_mentions(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_href text,
  p_post_id bigint DEFAULT NULL,
  p_reply_id bigint DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer := 0;
  v_uid uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_user_ids IS NULL THEN RETURN 0; END IF;

  -- authorship check when scoped to a post/reply
  IF p_reply_id IS NOT NULL THEN
    PERFORM 1 FROM public.community_replies WHERE id = p_reply_id AND author_id = v_actor;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_reply_author'; END IF;
  ELSIF p_post_id IS NOT NULL THEN
    PERFORM 1 FROM public.community_posts WHERE id = p_post_id AND author_id = v_actor;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_post_author'; END IF;
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids LOOP
    IF v_uid IS NULL OR v_uid = v_actor THEN CONTINUE; END IF;
    INSERT INTO public.notifications(user_id, kind, title, body, href, data)
    VALUES (
      v_uid, 'mention', p_title, p_body, p_href,
      jsonb_build_object('post_id', p_post_id, 'reply_id', p_reply_id, 'actor_id', v_actor)
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_notify_mentions(uuid[], text, text, text, bigint, bigint) TO authenticated;
