/**
 * Hero presentation options for a course page.
 *
 * Admins can either let the platform render the course title/subtitle over the
 * hero image, or hide that copy entirely when the uploaded background already
 * contains its own typography.
 */
export type HeroTitleSize = "sm" | "md" | "lg" | "xl";
export type HeroTitleFont = "serif" | "sans" | "mono";

export type CourseHeroSettings = {
  hero_text_hidden?: boolean | null;
  hero_title_color?: string | null;
  hero_title_size?: string | null;
  hero_title_font?: string | null;
  hero_overlay_opacity?: number | string | null;
};

export const HERO_SIZE_OPTIONS: { value: HeroTitleSize; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large (default)" },
  { value: "xl", label: "Extra large" },
];

export const HERO_FONT_OPTIONS: { value: HeroTitleFont; label: string }[] = [
  { value: "serif", label: "Serif (Cormorant Garamond)" },
  { value: "sans", label: "Sans (DM Sans)" },
  { value: "mono", label: "Mono" },
];

export const HERO_TITLE_CLASS: Record<HeroTitleSize, string> = {
  sm: "text-2xl sm:text-3xl lg:text-4xl",
  md: "text-3xl sm:text-4xl lg:text-5xl",
  lg: "text-4xl sm:text-5xl lg:text-6xl",
  xl: "text-5xl sm:text-6xl lg:text-7xl",
};

export const HERO_FONT_CLASS: Record<HeroTitleFont, string> = {
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

export const DEFAULT_HERO_SIZE: HeroTitleSize = "lg";
export const DEFAULT_HERO_FONT: HeroTitleFont = "serif";
export const DEFAULT_HERO_OVERLAY = 1;

export function heroSize(value: unknown): HeroTitleSize {
  return value === "sm" || value === "md" || value === "lg" || value === "xl" ? value : DEFAULT_HERO_SIZE;
}

export function heroFont(value: unknown): HeroTitleFont {
  return value === "serif" || value === "sans" || value === "mono" ? value : DEFAULT_HERO_FONT;
}

/** Clamp the scrim strength to 0–1 so a bad value can never hide the image. */
export function heroOverlay(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return DEFAULT_HERO_OVERLAY;
  return Math.min(1, Math.max(0, n));
}

/** Only accept plain CSS hex colours; anything else falls back to the theme. */
export function heroColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}

export function resolveHeroSettings(course: CourseHeroSettings) {
  return {
    hidden: course.hero_text_hidden === true,
    color: heroColor(course.hero_title_color),
    size: heroSize(course.hero_title_size),
    font: heroFont(course.hero_title_font),
    overlay: heroOverlay(course.hero_overlay_opacity),
  };
}
