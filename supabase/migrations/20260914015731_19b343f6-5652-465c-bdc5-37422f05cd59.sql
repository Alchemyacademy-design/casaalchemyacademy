-- 1. Community: teaser-level visibility for signed-in users only
DROP POLICY IF EXISTS community_spaces_member_select ON public.community_spaces;
DROP POLICY IF EXISTS community_channels_member_select ON public.community_channels;

CREATE POLICY community_spaces_teaser_select
  ON public.community_spaces FOR SELECT TO authenticated
  USING (status = 'published'::content_status);

CREATE POLICY community_channels_teaser_select
  ON public.community_channels FOR SELECT TO authenticated
  USING (
    status = 'published'::content_status
    AND EXISTS (
      SELECT 1 FROM public.community_spaces s
      WHERE s.id = community_channels.space_id
        AND s.status = 'published'::content_status
    )
  );

REVOKE SELECT ON public.community_spaces FROM anon;
REVOKE SELECT ON public.community_channels FROM anon;

-- 2. Quizzes: results are written only by the service-role grading path
DROP POLICY IF EXISTS quiz_attempts_insert_own ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_update_own_or_admin ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_answers_insert_own ON public.quiz_answers;
DROP POLICY IF EXISTS quiz_answers_update_own_or_admin ON public.quiz_answers;

CREATE POLICY quiz_attempts_update_admin
  ON public.quiz_attempts FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY quiz_answers_update_admin
  ON public.quiz_answers FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

REVOKE INSERT, UPDATE ON public.quiz_attempts FROM authenticated, anon;
REVOKE INSERT, UPDATE ON public.quiz_answers FROM authenticated, anon;
GRANT UPDATE ON public.quiz_attempts TO authenticated;
GRANT UPDATE ON public.quiz_answers TO authenticated;
GRANT SELECT ON public.quiz_attempts TO authenticated;
GRANT SELECT ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
GRANT ALL ON public.quiz_answers TO service_role;