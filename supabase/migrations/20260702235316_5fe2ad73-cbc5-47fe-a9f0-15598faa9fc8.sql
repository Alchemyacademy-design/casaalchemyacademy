
-- ---------- Categorias & tags ----------
CREATE TABLE IF NOT EXISTS public.course_categories (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  slug           text NOT NULL UNIQUE,
  description    text,
  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_categories TO authenticated;
GRANT ALL ON public.course_categories TO service_role;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS course_categories_read ON public.course_categories;
CREATE POLICY course_categories_read ON public.course_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS course_categories_admin_write ON public.course_categories;
CREATE POLICY course_categories_admin_write ON public.course_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role));

CREATE TABLE IF NOT EXISTS public.course_tags (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_tags TO authenticated;
GRANT ALL ON public.course_tags TO service_role;
ALTER TABLE public.course_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS course_tags_read ON public.course_tags;
CREATE POLICY course_tags_read ON public.course_tags FOR SELECT USING (true);
DROP POLICY IF EXISTS course_tags_admin_write ON public.course_tags;
CREATE POLICY course_tags_admin_write ON public.course_tags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role));

-- ---------- Courses: novas colunas ----------
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS short_description     text,
  ADD COLUMN IF NOT EXISTS banner_url            text,
  ADD COLUMN IF NOT EXISTS trailer_url           text,
  ADD COLUMN IF NOT EXISTS category_id           bigint REFERENCES public.course_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instructor_id         uuid,
  ADD COLUMN IF NOT EXISTS instructor_name       text,
  ADD COLUMN IF NOT EXISTS language              text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS level                 public.course_level,
  ADD COLUMN IF NOT EXISTS estimated_duration    int,
  ADD COLUMN IF NOT EXISTS has_certificate       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_publish_at  timestamptz,
  ADD COLUMN IF NOT EXISTS visibility            public.course_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS access_type           public.course_access_type NOT NULL DEFAULT 'plan',
  ADD COLUMN IF NOT EXISTS release_type          public.course_release_type NOT NULL DEFAULT 'all_at_once',
  ADD COLUMN IF NOT EXISTS updated_by            uuid;

CREATE INDEX IF NOT EXISTS courses_instructor_idx ON public.courses(instructor_id);
CREATE INDEX IF NOT EXISTS courses_category_idx   ON public.courses(category_id);
CREATE INDEX IF NOT EXISTS courses_status_idx     ON public.courses(status);
CREATE INDEX IF NOT EXISTS courses_scheduled_idx  ON public.courses(scheduled_publish_at) WHERE scheduled_publish_at IS NOT NULL;

-- ---------- course_modules: novas colunas ----------
ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS release_type            public.course_release_type NOT NULL DEFAULT 'all_at_once',
  ADD COLUMN IF NOT EXISTS release_after_days      int,
  ADD COLUMN IF NOT EXISTS release_at              timestamptz,
  ADD COLUMN IF NOT EXISTS prerequisite_module_id  bigint REFERENCES public.course_modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS course_modules_course_order_idx ON public.course_modules(course_id, sort_order);

-- ---------- lessons: novas colunas ----------
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS lesson_type             public.lesson_kind NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS is_mandatory            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_comments          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_download          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_type            public.course_release_type NOT NULL DEFAULT 'all_at_once',
  ADD COLUMN IF NOT EXISTS release_after_days      int,
  ADD COLUMN IF NOT EXISTS release_at              timestamptz,
  ADD COLUMN IF NOT EXISTS prerequisite_lesson_id  bigint REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              uuid;

CREATE INDEX IF NOT EXISTS lessons_module_order_idx ON public.lessons(module_id, sort_order);

-- ---------- Tag map ----------
CREATE TABLE IF NOT EXISTS public.course_tag_map (
  course_id bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tag_id    bigint NOT NULL REFERENCES public.course_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, tag_id)
);
GRANT SELECT ON public.course_tag_map TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_tag_map TO authenticated;
GRANT ALL ON public.course_tag_map TO service_role;
ALTER TABLE public.course_tag_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS course_tag_map_read ON public.course_tag_map;
CREATE POLICY course_tag_map_read ON public.course_tag_map FOR SELECT USING (true);
DROP POLICY IF EXISTS course_tag_map_admin_write ON public.course_tag_map;
CREATE POLICY course_tag_map_admin_write ON public.course_tag_map
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role));

-- ---------- Helpers ----------
CREATE OR REPLACE FUNCTION public.owns_course(_course_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.courses c WHERE c.id = _course_id AND c.instructor_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.owns_course(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_course(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.owns_lesson(_lesson_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = _lesson_id AND c.instructor_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.owns_lesson(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_lesson(bigint) TO authenticated;

-- ---------- lesson_blocks ----------
CREATE TABLE IF NOT EXISTS public.lesson_blocks (
  id          bigserial PRIMARY KEY,
  lesson_id   bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  block_type  text NOT NULL,
  content     jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  position    int NOT NULL DEFAULT 0,
  is_visible  boolean NOT NULL DEFAULT true,
  created_by  uuid,
  updated_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_blocks TO authenticated;
GRANT ALL ON public.lesson_blocks TO service_role;
ALTER TABLE public.lesson_blocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS lesson_blocks_lesson_idx ON public.lesson_blocks(lesson_id, position);

DROP POLICY IF EXISTS lesson_blocks_admin_all ON public.lesson_blocks;
CREATE POLICY lesson_blocks_admin_all ON public.lesson_blocks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role));

DROP POLICY IF EXISTS lesson_blocks_instructor_all ON public.lesson_blocks;
CREATE POLICY lesson_blocks_instructor_all ON public.lesson_blocks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_lesson(lesson_id))
  WITH CHECK (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_lesson(lesson_id));

DROP POLICY IF EXISTS lesson_blocks_learner_read ON public.lesson_blocks;
CREATE POLICY lesson_blocks_learner_read ON public.lesson_blocks
  FOR SELECT TO authenticated
  USING (is_visible = true AND public.can_access_lesson(lesson_id));

-- ---------- lesson_attachments ----------
CREATE TABLE IF NOT EXISTS public.lesson_attachments (
  id              bigserial PRIMARY KEY,
  lesson_id       bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  storage_bucket  text NOT NULL DEFAULT 'course-assets',
  storage_path    text NOT NULL,
  file_type       text,
  file_size       bigint,
  is_downloadable boolean NOT NULL DEFAULT true,
  is_public       boolean NOT NULL DEFAULT false,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_attachments TO authenticated;
GRANT ALL ON public.lesson_attachments TO service_role;
ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS lesson_attachments_lesson_idx ON public.lesson_attachments(lesson_id);

DROP POLICY IF EXISTS lesson_attachments_admin_all ON public.lesson_attachments;
CREATE POLICY lesson_attachments_admin_all ON public.lesson_attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role));

DROP POLICY IF EXISTS lesson_attachments_instructor_all ON public.lesson_attachments;
CREATE POLICY lesson_attachments_instructor_all ON public.lesson_attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_lesson(lesson_id))
  WITH CHECK (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_lesson(lesson_id));

DROP POLICY IF EXISTS lesson_attachments_learner_read ON public.lesson_attachments;
CREATE POLICY lesson_attachments_learner_read ON public.lesson_attachments
  FOR SELECT TO authenticated
  USING (public.can_access_lesson(lesson_id));

-- ---------- Instructor/content_manager policies em courses/course_modules/lessons ----------
DROP POLICY IF EXISTS courses_instructor_manage ON public.courses;
CREATE POLICY courses_instructor_manage ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'instructor'::app_role) AND instructor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'instructor'::app_role) AND instructor_id = auth.uid());

DROP POLICY IF EXISTS courses_content_manager_all ON public.courses;
CREATE POLICY courses_content_manager_all ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'content_manager'::app_role));

DROP POLICY IF EXISTS course_modules_instructor_manage ON public.course_modules;
CREATE POLICY course_modules_instructor_manage ON public.course_modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_course(course_id))
  WITH CHECK (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_course(course_id));

DROP POLICY IF EXISTS course_modules_content_manager_all ON public.course_modules;
CREATE POLICY course_modules_content_manager_all ON public.course_modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'content_manager'::app_role));

DROP POLICY IF EXISTS lessons_instructor_manage ON public.lessons;
CREATE POLICY lessons_instructor_manage ON public.lessons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_lesson(id))
  WITH CHECK (public.has_role(auth.uid(),'instructor'::app_role) AND public.owns_lesson(id));

DROP POLICY IF EXISTS lessons_content_manager_all ON public.lessons;
CREATE POLICY lessons_content_manager_all ON public.lessons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'content_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'content_manager'::app_role));

-- ---------- Auditoria ----------
CREATE TABLE IF NOT EXISTS public.course_audit_logs (
  id            bigserial PRIMARY KEY,
  actor_user_id uuid,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     bigint,
  course_id     bigint,
  before_data   jsonb,
  after_data    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_audit_logs TO authenticated;
GRANT ALL ON public.course_audit_logs TO service_role;
ALTER TABLE public.course_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS course_audit_logs_entity_idx ON public.course_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS course_audit_logs_course_idx ON public.course_audit_logs(course_id, created_at DESC);

DROP POLICY IF EXISTS course_audit_logs_admin_read ON public.course_audit_logs;
CREATE POLICY course_audit_logs_admin_read ON public.course_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'content_manager'::app_role));

CREATE OR REPLACE FUNCTION public.log_course_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_course bigint;
  v_before jsonb;
  v_after  jsonb;
  v_id     bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD); v_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_after  := to_jsonb(NEW); v_id := NEW.id;
  ELSE
    v_before := to_jsonb(OLD); v_after := to_jsonb(NEW); v_id := NEW.id;
  END IF;

  IF v_entity = 'course' THEN
    v_course := v_id;
  ELSIF v_entity = 'module' THEN
    v_course := COALESCE((v_after->>'course_id')::bigint, (v_before->>'course_id')::bigint);
  ELSIF v_entity = 'lesson' THEN
    v_course := (
      SELECT m.course_id FROM public.course_modules m
      WHERE m.id = COALESCE((v_after->>'module_id')::bigint, (v_before->>'module_id')::bigint)
    );
  ELSIF v_entity = 'block' THEN
    v_course := (
      SELECT m.course_id
      FROM public.lessons l JOIN public.course_modules m ON m.id = l.module_id
      WHERE l.id = COALESCE((v_after->>'lesson_id')::bigint, (v_before->>'lesson_id')::bigint)
    );
  END IF;

  INSERT INTO public.course_audit_logs(actor_user_id, action, entity_type, entity_id, course_id, before_data, after_data)
  VALUES (auth.uid(), TG_OP, v_entity, v_id, v_course, v_before, v_after);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.log_course_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_courses ON public.courses;
CREATE TRIGGER trg_audit_courses AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.log_course_audit('course');

DROP TRIGGER IF EXISTS trg_audit_course_modules ON public.course_modules;
CREATE TRIGGER trg_audit_course_modules AFTER INSERT OR UPDATE OR DELETE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.log_course_audit('module');

DROP TRIGGER IF EXISTS trg_audit_lessons ON public.lessons;
CREATE TRIGGER trg_audit_lessons AFTER INSERT OR UPDATE OR DELETE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.log_course_audit('lesson');

DROP TRIGGER IF EXISTS trg_audit_lesson_blocks ON public.lesson_blocks;
CREATE TRIGGER trg_audit_lesson_blocks AFTER INSERT OR UPDATE OR DELETE ON public.lesson_blocks
  FOR EACH ROW EXECUTE FUNCTION public.log_course_audit('block');

-- ---------- Touch updated_at ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_lesson_blocks_touch ON public.lesson_blocks;
CREATE TRIGGER trg_lesson_blocks_touch BEFORE UPDATE ON public.lesson_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_course_categories_touch ON public.course_categories;
CREATE TRIGGER trg_course_categories_touch BEFORE UPDATE ON public.course_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
