
CREATE TABLE public.post_reports (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_reports_status_chk CHECK (status IN ('open','resolved','dismissed')),
  CONSTRAINT post_reports_reason_len CHECK (char_length(reason) BETWEEN 1 AND 80)
);

GRANT SELECT, INSERT, UPDATE ON public.post_reports TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.post_reports_id_seq TO authenticated;
GRANT ALL ON public.post_reports TO service_role;
GRANT ALL ON SEQUENCE public.post_reports_id_seq TO service_role;

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter can insert own report"
  ON public.post_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporter can read own reports"
  ON public.post_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can read all reports"
  ON public.post_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
  ON public.post_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_post_reports_status ON public.post_reports(status, created_at DESC);
CREATE INDEX idx_post_reports_post ON public.post_reports(post_id);

CREATE TRIGGER trg_post_reports_touch
BEFORE UPDATE ON public.post_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
