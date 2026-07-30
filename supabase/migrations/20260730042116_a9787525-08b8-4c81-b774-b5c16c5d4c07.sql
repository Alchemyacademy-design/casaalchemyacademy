ALTER TABLE public.lesson_attachments
  ADD COLUMN IF NOT EXISTS module_id bigint REFERENCES public.course_modules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS material_kind text NOT NULL DEFAULT 'lesson';

UPDATE public.lesson_attachments
SET material_kind = CASE
  WHEN lesson_id IS NOT NULL THEN 'lesson'
  WHEN course_id IS NOT NULL THEN 'course'
  ELSE 'bonus'
END;

ALTER TABLE public.lesson_attachments
  DROP CONSTRAINT IF EXISTS lesson_attachments_scope_chk;

ALTER TABLE public.lesson_attachments
  ADD CONSTRAINT lesson_attachments_scope_chk CHECK (
    (material_kind = 'lesson' AND lesson_id IS NOT NULL AND module_id IS NULL AND course_id IS NULL)
    OR (material_kind = 'module' AND module_id IS NOT NULL AND lesson_id IS NULL AND course_id IS NULL)
    OR (material_kind = 'course' AND course_id IS NOT NULL AND lesson_id IS NULL AND module_id IS NULL)
    OR (material_kind = 'bonus' AND course_id IS NULL AND lesson_id IS NULL AND module_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS lesson_attachments_module_id_idx ON public.lesson_attachments(module_id);
CREATE INDEX IF NOT EXISTS lesson_attachments_kind_idx ON public.lesson_attachments(material_kind);

DROP POLICY IF EXISTS lesson_attachments_learner_read ON public.lesson_attachments;
CREATE POLICY lesson_attachments_learner_read
  ON public.lesson_attachments
  FOR SELECT
  TO authenticated
  USING (
    (lesson_id IS NOT NULL AND public.can_access_lesson(lesson_id))
    OR (module_id IS NOT NULL AND public.can_access_module(module_id))
    OR (course_id IS NOT NULL AND public.can_access_course(course_id))
    OR (material_kind = 'bonus' AND is_public = true AND auth.uid() IS NOT NULL)
  );

DROP POLICY IF EXISTS course_assets_materials_learner_read ON storage.objects;
CREATE POLICY course_assets_materials_learner_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND name LIKE 'materials/%'
    AND EXISTS (
      SELECT 1
      FROM public.lesson_attachments a
      WHERE a.storage_bucket = 'course-assets'
        AND a.storage_path = objects.name
        AND (
          (a.lesson_id IS NOT NULL AND public.can_access_lesson(a.lesson_id))
          OR (a.module_id IS NOT NULL AND public.can_access_module(a.module_id))
          OR (a.course_id IS NOT NULL AND public.can_access_course(a.course_id))
          OR (a.material_kind = 'bonus' AND a.is_public = true)
        )
    )
  );