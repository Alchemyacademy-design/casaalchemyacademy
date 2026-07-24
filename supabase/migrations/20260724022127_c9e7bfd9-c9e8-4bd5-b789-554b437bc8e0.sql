-- 1) Remove permissive INSERT on public.leads; edge function uses service_role which bypasses RLS
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

-- 2) Revoke EXECUTE on trigger-only functions (no legitimate direct-call use)
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_designated_admin() FROM PUBLIC, anon, authenticated;

-- 3) Revoke EXECUTE on internal quiz submission; only service_role (edge function) may call it.
--    This function does not validate p_user_id against auth.uid() and would allow a
--    signed-in user to submit attempts on behalf of another user.
REVOKE EXECUTE ON FUNCTION public.internal_submit_quiz_attempt(uuid, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- 4) Harden community_notify_mentions: require post_id OR reply_id so authorship check always runs.
--    Also revoke anon EXECUTE for hygiene (auth.uid() null-check already blocks anon at runtime).
CREATE OR REPLACE FUNCTION public.community_notify_mentions(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_href text,
  p_post_id bigint DEFAULT NULL::bigint,
  p_reply_id bigint DEFAULT NULL::bigint
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer := 0;
  v_uid uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_user_ids IS NULL THEN RETURN 0; END IF;

  -- Require scoping to a real post or reply. Without this guard any signed-in
  -- user could push arbitrary "mention" notifications to any user IDs.
  IF p_post_id IS NULL AND p_reply_id IS NULL THEN
    RAISE EXCEPTION 'mention_scope_required';
  END IF;

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
$function$;

REVOKE EXECUTE ON FUNCTION public.community_notify_mentions(uuid[], text, text, text, bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_notify_mentions(uuid[], text, text, text, bigint, bigint) TO authenticated, service_role;