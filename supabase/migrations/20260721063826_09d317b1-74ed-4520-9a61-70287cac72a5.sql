
-- ============================================================
-- Google Calendar own-OAuth integration (independent of App User Connector)
-- ============================================================

-- 1) Connections table
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_account_email text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  connection_status text NOT NULL DEFAULT 'connected'
    CHECK (connection_status IN ('connected','needs_reconnect','disconnected','revoked')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_calendar_connections_user_unique UNIQUE (user_id)
);

-- Grants: users must NOT read token columns directly. We expose a safe view below;
-- the base table is service-role only for tokens, but we still allow the owner to
-- read/update non-secret metadata via column-level policies enforced through the view.
GRANT SELECT ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Owner may read their own row; front-end code must query the safe view instead of
-- selecting token columns directly. RLS still prevents cross-user access.
DROP POLICY IF EXISTS "gcal_conn_owner_select" ON public.google_calendar_connections;
CREATE POLICY "gcal_conn_owner_select"
  ON public.google_calendar_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No insert/update/delete for regular users — only service_role (edge functions) writes.
DROP POLICY IF EXISTS "gcal_conn_service_all" ON public.google_calendar_connections;
CREATE POLICY "gcal_conn_service_all"
  ON public.google_calendar_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Safe view that hides secret columns; the front-end should read this view.
CREATE OR REPLACE VIEW public.my_google_calendar_connection
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  google_account_email,
  granted_scopes,
  connection_status,
  connected_at,
  disconnected_at,
  (token_expires_at IS NOT NULL AND token_expires_at < now()) AS access_token_expired,
  (refresh_token_encrypted IS NOT NULL) AS has_refresh_token,
  updated_at
FROM public.google_calendar_connections
WHERE user_id = auth.uid();

GRANT SELECT ON public.my_google_calendar_connection TO authenticated;

CREATE INDEX IF NOT EXISTS idx_gcal_conn_user ON public.google_calendar_connections(user_id);

-- 2) OAuth state table (transient, hashed, single-use)
CREATE TABLE IF NOT EXISTS public.google_calendar_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_path text NOT NULL DEFAULT '/profile',
  code_verifier_encrypted text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.google_calendar_oauth_states TO service_role;

ALTER TABLE public.google_calendar_oauth_states ENABLE ROW LEVEL SECURITY;

-- Only service role touches this table.
DROP POLICY IF EXISTS "gcal_state_service_all" ON public.google_calendar_oauth_states;
CREATE POLICY "gcal_state_service_all"
  ON public.google_calendar_oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_gcal_state_expires ON public.google_calendar_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_gcal_state_user ON public.google_calendar_oauth_states(user_id);

-- 3) Updated_at trigger
CREATE OR REPLACE FUNCTION public.gcal_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gcal_conn_updated_at ON public.google_calendar_connections;
CREATE TRIGGER trg_gcal_conn_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.gcal_touch_updated_at();
