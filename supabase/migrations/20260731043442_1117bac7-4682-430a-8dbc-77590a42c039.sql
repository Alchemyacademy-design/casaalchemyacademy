CREATE TABLE IF NOT EXISTS public.admin_access_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  target_user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.admin_access_audit_log TO authenticated;
GRANT ALL ON public.admin_access_audit_log TO service_role;

ALTER TABLE public.admin_access_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read access audit log" ON public.admin_access_audit_log;
CREATE POLICY "Admins can read access audit log"
  ON public.admin_access_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS admin_access_audit_log_target_idx
  ON public.admin_access_audit_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_access_audit_log_created_idx
  ON public.admin_access_audit_log (created_at DESC);