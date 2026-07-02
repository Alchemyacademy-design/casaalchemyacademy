-- Add optional comment field to lesson_ratings for richer feedback
ALTER TABLE public.lesson_ratings 
  ADD COLUMN IF NOT EXISTS comment text;

-- Ensure moderation_actions can reference lesson_comments (nullable columns)
ALTER TABLE public.moderation_actions
  ADD COLUMN IF NOT EXISTS lesson_comment_id bigint REFERENCES public.lesson_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_moderation_actions_lesson_comment_id 
  ON public.moderation_actions(lesson_comment_id);