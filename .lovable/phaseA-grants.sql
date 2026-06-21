-- Phase A: GRANTs públicos + autenticados (rodar via SQL Editor do Supabase)
-- Idempotente. NÃO altera RLS existente.

-- 1) Conteúdo público para anônimos (catálogo aberto):
GRANT SELECT ON public.courses              TO anon;
GRANT SELECT ON public.course_modules       TO anon;
GRANT SELECT ON public.lessons              TO anon;
GRANT SELECT ON public.events               TO anon;
GRANT SELECT ON public.live_workshops       TO anon;
GRANT SELECT ON public.magazine_issues      TO anon;
GRANT SELECT ON public.membership_plans     TO anon;
GRANT SELECT ON public.exclusive_deals      TO anon;
GRANT SELECT ON public.suppliers            TO anon;
GRANT SELECT ON public.supplier_categories  TO anon;
GRANT SELECT ON public.community_spaces     TO anon;
GRANT SELECT ON public.community_channels   TO anon;

-- 2) Tabelas de usuário autenticado (RLS por user_id):
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','memberships','registrations','lesson_progress',
    'quiz_attempts','quiz_answers','supplier_favorites','certificates',
    'community_posts','community_replies','community_reactions',
    'course_entitlements','user_roles',
    'courses','course_modules','lessons','events','live_workshops',
    'magazine_issues','membership_plans','exclusive_deals','suppliers',
    'supplier_categories','community_spaces','community_channels',
    'quizzes','quiz_questions','quiz_options','plan_permissions','moderation_actions'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END$$;
