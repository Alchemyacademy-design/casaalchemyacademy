ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS hero_text_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hero_title_color text,
  ADD COLUMN IF NOT EXISTS hero_title_size text,
  ADD COLUMN IF NOT EXISTS hero_title_font text,
  ADD COLUMN IF NOT EXISTS hero_overlay_opacity numeric;