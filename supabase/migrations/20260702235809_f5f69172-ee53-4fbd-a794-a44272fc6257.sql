
-- storage.objects policies para o bucket privado course-assets
-- Convenção de path: course-<courseId>/lesson-<lessonId>/<file>

DROP POLICY IF EXISTS course_assets_admin_all ON storage.objects;
CREATE POLICY course_assets_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND (public.has_role(auth.uid(),'admin'::app_role)
         OR public.has_role(auth.uid(),'content_manager'::app_role))
  )
  WITH CHECK (
    bucket_id = 'course-assets'
    AND (public.has_role(auth.uid(),'admin'::app_role)
         OR public.has_role(auth.uid(),'content_manager'::app_role))
  );

DROP POLICY IF EXISTS course_assets_instructor_all ON storage.objects;
CREATE POLICY course_assets_instructor_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND public.has_role(auth.uid(),'instructor'::app_role)
    AND public.owns_course(
      NULLIF(regexp_replace(split_part(name, '/', 1), '^course-', ''), '')::bigint
    )
  )
  WITH CHECK (
    bucket_id = 'course-assets'
    AND public.has_role(auth.uid(),'instructor'::app_role)
    AND public.owns_course(
      NULLIF(regexp_replace(split_part(name, '/', 1), '^course-', ''), '')::bigint
    )
  );
