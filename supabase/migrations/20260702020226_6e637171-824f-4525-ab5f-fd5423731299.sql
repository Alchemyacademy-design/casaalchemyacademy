ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS module_id bigint NULL REFERENCES public.course_modules(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS quizzes_module_id_idx ON public.quizzes(module_id);

CREATE OR REPLACE FUNCTION public.quiz_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.lesson_id IS NOT NULL AND NEW.module_id IS NOT NULL THEN
    RAISE EXCEPTION 'quiz_scope_conflict: lesson_id and module_id are mutually exclusive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_scope_guard_trg ON public.quizzes;
CREATE TRIGGER quiz_scope_guard_trg
BEFORE INSERT OR UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.quiz_scope_guard();