CREATE TABLE public.lead_capture_rate_limits (
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, window_start)
);
GRANT ALL ON public.lead_capture_rate_limits TO service_role;
ALTER TABLE public.lead_capture_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.lead_capture_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX lead_capture_rate_limits_window_idx ON public.lead_capture_rate_limits (window_start);