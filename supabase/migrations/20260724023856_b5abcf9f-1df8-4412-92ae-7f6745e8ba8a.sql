-- Consolidate admin RLS: drop redundant admin_full_access (has_role) policies
-- on tables already covered by private.is_admin()-based policies.
-- private.is_admin() is equivalent-or-stricter: same user_roles EXISTS check,
-- empty search_path (harder to hijack), invoked as (SELECT ...) so Postgres
-- evaluates it once per statement instead of once per row.
-- quiz_options: admin reads go via service-role edge function get-admin-quiz;
-- table-level SELECT is intentionally revoked from anon/authenticated.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'certificates',
    'community_channels',
    'community_posts',
    'community_reactions',
    'community_replies',
    'community_spaces',
    'course_modules',
    'courses',
    'events',
    'exclusive_deals',
    'lessons',
    'live_workshops',
    'magazine_issues',
    'membership_plans',
    'moderation_actions',
    'plan_permissions',
    'quiz_options',
    'quiz_questions',
    'quizzes',
    'registrations',
    'supplier_categories',
    'suppliers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_full_access ON public.%I', t);
  END LOOP;
END$$;