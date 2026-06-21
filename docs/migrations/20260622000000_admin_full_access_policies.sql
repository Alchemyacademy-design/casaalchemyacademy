-- Phase 1 — Grant admin role full read/write on every content table the
-- Central Administrativa needs to manage. Existing public-read policies are
-- preserved; we only ADD an admin policy and ensure the `authenticated` /
-- `service_role` grants exist. Safe to re-run.
--
-- Apply via Supabase SQL Editor while logged in to project omzwtfnqffseemrlylwu.

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'events',
    'live_workshops',
    'magazine_issues',
    'suppliers',
    'supplier_categories',
    'exclusive_deals',
    'membership_plans',
    'plan_permissions',
    'quizzes',
    'quiz_questions',
    'quiz_options',
    'community_spaces',
    'community_channels',
    'community_posts',
    'community_replies',
    'moderation_actions',
    'certificates',
    'registrations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_full_access ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY admin_full_access ON public.%I
        FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role))
    $f$, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END$$;

COMMIT;
