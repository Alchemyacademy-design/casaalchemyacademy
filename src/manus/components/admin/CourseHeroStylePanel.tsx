import { resolveAssetUrl } from "@/manus/lib/asset-url";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  HERO_FONT_CLASS,
  HERO_FONT_OPTIONS,
  HERO_SIZE_OPTIONS,
  HERO_TITLE_CLASS,
  resolveHeroSettings,
  type CourseHeroSettings,
} from "@/manus/lib/course-hero";

type Course = CourseHeroSettings & {
  title: string;
  subtitle: string | null;
  banner_url: string | null;
  cover_image_path: string | null;
};

/**
 * Admin controls for the course hero: title colour, size and font, scrim
 * strength, plus a switch to hide the copy completely when the uploaded
 * background image already contains the title and description.
 */
export default function CourseHeroStylePanel({
  course,
  onPatch,
}: {
  course: Course;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const hero = resolveHeroSettings(course);
  const image = resolveAssetUrl(course.banner_url || course.cover_image_path);

  return (
    <div className="space-y-3 rounded border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-xs">Hero title style</Label>
          <p className="text-[11px] leading-4 text-foreground/50">
            Control how the course title and subtitle are drawn on top of the hero image.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded border bg-background p-3">
        <Switch
          checked={hero.hidden}
          onCheckedChange={(checked) => onPatch({ hero_text_hidden: checked })}
          aria-label="Hide hero title and subtitle"
        />
        <span className="text-xs leading-5 text-foreground/70">
          <span className="font-medium text-foreground">My image already has the title and description</span>
          <br />
          Hides the overlaid text and the dark scrim, showing the artwork exactly as uploaded.
        </span>
      </label>

      {!hero.hidden && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Title size</Label>
            <select
              className="mt-1 h-9 w-full rounded border bg-background px-2 text-xs"
              value={hero.size}
              onChange={(e) => onPatch({ hero_title_size: e.currentTarget.value })}
            >
              {HERO_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Title font</Label>
            <select
              className="mt-1 h-9 w-full rounded border bg-background px-2 text-xs"
              value={hero.font}
              onChange={(e) => onPatch({ hero_title_font: e.currentTarget.value })}
            >
              {HERO_FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Text colour</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                aria-label="Hero text colour"
                value={hero.color ?? "#ffffff"}
                onChange={(e) => onPatch({ hero_title_color: e.currentTarget.value })}
                className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
              />
              <span className="font-mono text-[11px] text-foreground/60">{hero.color ?? "default (white)"}</span>
              {hero.color && (
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onPatch({ hero_title_color: null })}>
                  Reset
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs">Image darkening ({Math.round(hero.overlay * 100)}%)</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={hero.overlay}
              aria-label="Hero image darkening"
              onChange={(e) => onPatch({ hero_overlay_opacity: Number(e.currentTarget.value) })}
              className="mt-3 w-full"
            />
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-foreground/50">Live preview</p>
        <div
          className="relative flex min-h-[9rem] items-end overflow-hidden rounded border bg-neutral-800 bg-cover bg-center"
          style={image ? { backgroundImage: `url("${image}")` } : undefined}
        >
          {!hero.hidden && (
            <>
              <div
                className="absolute inset-0"
                style={{
                  opacity: hero.overlay,
                  background:
                    "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.1) 75%)",
                }}
              />
              <div className="relative z-10 max-w-full p-4">
                <p
                  className={`${HERO_FONT_CLASS[hero.font]} ${HERO_TITLE_CLASS[hero.size]} leading-none`}
                  style={{ color: hero.color ?? "#ffffff" }}
                >
                  {course.title || "Course title"}
                </p>
                {course.subtitle && (
                  <p className="mt-2 text-xs" style={{ color: hero.color ?? "#ffffff" }}>{course.subtitle}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
