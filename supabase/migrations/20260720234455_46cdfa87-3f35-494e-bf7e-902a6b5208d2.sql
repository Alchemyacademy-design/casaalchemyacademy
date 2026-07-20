
-- 1) opt-out column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out boolean NOT NULL DEFAULT false;

-- 2) Leaderboard function
CREATE OR REPLACE FUNCTION public.get_alchemist_leaderboard(p_window text DEFAULT 'all', p_limit integer DEFAULT 10)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_path text,
  xp integer,
  tier text,
  rank integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_since timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_window = '30d' THEN
    v_since := now() - interval '30 days';
  ELSE
    v_since := 'epoch'::timestamptz;
  END IF;

  RETURN QUERY
  WITH
    lesson_xp AS (
      SELECT lp.user_id, count(*)::int * 10 AS xp
      FROM public.lesson_progress lp
      WHERE lp.completed_at IS NOT NULL AND lp.completed_at >= v_since
      GROUP BY lp.user_id
    ),
    quiz_xp AS (
      SELECT qa.user_id, count(DISTINCT qa.quiz_id)::int * 25 AS xp
      FROM public.quiz_attempts qa
      WHERE qa.passed = true AND qa.submitted_at IS NOT NULL AND qa.submitted_at >= v_since
      GROUP BY qa.user_id
    ),
    post_xp AS (
      SELECT cp.author_id AS user_id, LEAST(count(*), 500)::int * 5 AS xp
      FROM public.community_posts cp
      WHERE cp.status = 'published' AND cp.created_at >= v_since
      GROUP BY cp.author_id
    ),
    reply_xp AS (
      SELECT cr.author_id AS user_id, LEAST(count(*), 1000)::int * 3 AS xp
      FROM public.community_replies cr
      WHERE cr.created_at >= v_since
      GROUP BY cr.author_id
    ),
    cert_xp AS (
      SELECT c.user_id, count(*)::int * 200 AS xp
      FROM public.certificates c
      WHERE c.revoked_at IS NULL AND c.issued_at >= v_since
      GROUP BY c.user_id
    ),
    totals AS (
      SELECT
        p.id AS user_id,
        p.display_name,
        p.full_name,
        p.avatar_path,
        COALESCE(lesson_xp.xp, 0)
          + COALESCE(quiz_xp.xp, 0)
          + COALESCE(post_xp.xp, 0)
          + COALESCE(reply_xp.xp, 0)
          + COALESCE(cert_xp.xp, 0) AS total_xp
      FROM public.profiles p
      LEFT JOIN lesson_xp ON lesson_xp.user_id = p.id
      LEFT JOIN quiz_xp ON quiz_xp.user_id = p.id
      LEFT JOIN post_xp ON post_xp.user_id = p.id
      LEFT JOIN reply_xp ON reply_xp.user_id = p.id
      LEFT JOIN cert_xp ON cert_xp.user_id = p.id
      WHERE p.leaderboard_opt_out = false
        AND NOT EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = p.id AND ur.role = 'admin'
        )
    ),
    ranked AS (
      SELECT
        t.user_id,
        COALESCE(NULLIF(btrim(t.display_name), ''), NULLIF(btrim(t.full_name), ''), 'Alchemist ' || substr(t.user_id::text, 1, 6)) AS display_name,
        t.avatar_path,
        t.total_xp,
        CASE
          WHEN t.total_xp >= 4000 THEN 'Luminary'
          WHEN t.total_xp >= 1500 THEN 'Master'
          WHEN t.total_xp >= 500 THEN 'Alchemist'
          WHEN t.total_xp >= 100 THEN 'Apprentice'
          ELSE 'Novice'
        END AS tier_name,
        row_number() OVER (ORDER BY t.total_xp DESC, t.user_id) AS rnk
      FROM totals t
      WHERE t.total_xp > 0
    )
  SELECT
    r.user_id,
    r.display_name,
    r.avatar_path,
    r.total_xp,
    r.tier_name,
    r.rnk::int
  FROM ranked r
  ORDER BY r.rnk
  LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$function$;

-- 3) My stats function
CREATE OR REPLACE FUNCTION public.get_my_alchemist_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lesson int := 0;
  v_quiz int := 0;
  v_post int := 0;
  v_reply int := 0;
  v_cert int := 0;
  v_xp int := 0;
  v_tier text;
  v_next_tier text;
  v_next_at int;
  v_current_floor int;
  v_rank_all int;
  v_rank_30d int;
  v_opt_out boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT count(*)::int * 10 INTO v_lesson
  FROM public.lesson_progress WHERE user_id = v_uid AND completed_at IS NOT NULL;

  SELECT count(DISTINCT quiz_id)::int * 25 INTO v_quiz
  FROM public.quiz_attempts WHERE user_id = v_uid AND passed = true AND submitted_at IS NOT NULL;

  SELECT LEAST(count(*), 500)::int * 5 INTO v_post
  FROM public.community_posts WHERE author_id = v_uid AND status = 'published';

  SELECT LEAST(count(*), 1000)::int * 3 INTO v_reply
  FROM public.community_replies WHERE author_id = v_uid;

  SELECT count(*)::int * 200 INTO v_cert
  FROM public.certificates WHERE user_id = v_uid AND revoked_at IS NULL;

  v_xp := COALESCE(v_lesson, 0) + COALESCE(v_quiz, 0) + COALESCE(v_post, 0) + COALESCE(v_reply, 0) + COALESCE(v_cert, 0);

  IF v_xp >= 4000 THEN
    v_tier := 'Luminary'; v_next_tier := NULL; v_next_at := NULL; v_current_floor := 4000;
  ELSIF v_xp >= 1500 THEN
    v_tier := 'Master'; v_next_tier := 'Luminary'; v_next_at := 4000; v_current_floor := 1500;
  ELSIF v_xp >= 500 THEN
    v_tier := 'Alchemist'; v_next_tier := 'Master'; v_next_at := 1500; v_current_floor := 500;
  ELSIF v_xp >= 100 THEN
    v_tier := 'Apprentice'; v_next_tier := 'Alchemist'; v_next_at := 500; v_current_floor := 100;
  ELSE
    v_tier := 'Novice'; v_next_tier := 'Apprentice'; v_next_at := 100; v_current_floor := 0;
  END IF;

  SELECT leaderboard_opt_out INTO v_opt_out FROM public.profiles WHERE id = v_uid;

  -- rank all-time
  SELECT rnk INTO v_rank_all FROM public.get_alchemist_leaderboard('all', 100) WHERE user_id = v_uid;
  SELECT rnk INTO v_rank_30d FROM public.get_alchemist_leaderboard('30d', 100) WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'xp', v_xp,
    'tier', v_tier,
    'next_tier', v_next_tier,
    'next_tier_at', v_next_at,
    'current_tier_floor', v_current_floor,
    'rank_all', v_rank_all,
    'rank_30d', v_rank_30d,
    'opt_out', COALESCE(v_opt_out, false),
    'breakdown', jsonb_build_object(
      'lessons', v_lesson,
      'quizzes', v_quiz,
      'community_posts', v_post,
      'community_replies', v_reply,
      'certificates', v_cert
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_alchemist_leaderboard(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_alchemist_stats() TO authenticated;

-- allow rank lookup within stats function to alias column
