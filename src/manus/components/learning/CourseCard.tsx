import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CourseCardData = {
  id: number;
  title: string;
  subtitle?: string | null;
  number?: number | string | null;
  thumbnail?: string | null;
  lessonCount?: number;
  progressPercent?: number;
  /** True when the course is published; false ⇒ Draft. */
  published?: boolean;
  /** True when content exists but checkout is deferred (pré-lançamento). */
  comingSoon?: boolean;
  locked?: boolean;
  href?: string;
};

export type CourseCardProps = {
  course: CourseCardData;
  variant?: "landing" | "member";
};

export default function CourseCard({ course, variant = "member" }: CourseCardProps) {
  const {
    title,
    subtitle,
    number,
    thumbnail,
    lessonCount,
    progressPercent,
    published = true,
    comingSoon = false,
    locked = false,
    href,
  } = course;

  const pct = progressPercent ?? 0;
  const numberLabel =
    number == null
      ? null
      : typeof number === "number"
        ? String(number).padStart(2, "0")
        : number;
  const showProgress = !locked && !comingSoon && pct > 0 && (lessonCount ?? 0) > 0;
  const completed = pct === 100;
  const canVisit = !!href && !locked && !comingSoon;

  return (
    <article
      data-testid="aa-course-card"
      data-variant={variant}
      className={`aa-course-card relative overflow-hidden group flex flex-col rounded-md border border-border/50 transition-all duration-[250ms] hover:border-border hover:-translate-y-[3px] hover:shadow-md ${
        variant === "landing" ? "min-h-[280px] p-7" : "min-h-[260px]"
      }`}
      style={
        thumbnail
          ? {
              backgroundImage: `url(${thumbnail})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { backgroundColor: "hsl(var(--card))" }
      }
    >
      {thumbnail && (
        <div className="aa-overlay absolute inset-0" aria-hidden="true" />)
      )}

      <div className="relative z-10 flex flex-col flex-1 p-6">
        <div className="flex items-start justify-between mb-3">
          {numberLabel != null && (
            <span
              className={`font-serif text-2xl ${thumbnail ? "text-white" : "text-primary"} font-light`}
              aria-hidden="true"
            >
              {numberLabel}
            </span>
          )}
          <div className="flex items-center gap-2">
            {!published && (
              <span className="text-[10px] px-2 py-0.5 rounded-sm bg-foreground/70 text-background uppercase tracking-wider">
                Draft
              </span>
            )}
            {comingSoon && (
              <span className="text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground uppercase tracking-wider">
                Coming Soon
              </span>
            )}
            {locked && !comingSoon && (
              <Lock
                className={`w-4 h-4 ${thumbnail ? "text-white" : "text-foreground/60"}`}
                aria-label="Locked"
              />
            )}
            {completed && !locked && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label="Completed" />
            )}
          </div>
        </div>

        <h3
          className={`font-serif text-xl mb-2 ${thumbnail ? "text-white" : "text-foreground"}`}
          style={{ fontWeight: 400 }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className={`text-xs leading-relaxed mb-4 flex-1 ${
              thumbnail ? "text-white/85" : "text-foreground/70"
            }`}
          >
            {subtitle}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <span
            className={`text-[11px] uppercase tracking-wider ${
              thumbnail ? "text-white/80" : "text-foreground/60"
            }`}
          >
            {typeof lessonCount === "number"
              ? `${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`
              : ""}
            {showProgress ? ` · ${pct}% done` : ""}
          </span>

          {comingSoon ? (
            <span
              className={`text-xs uppercase tracking-wider ${
                thumbnail ? "text-white/80" : "text-foreground/60"
              }`}
            >
              Coming soon
            </span>
          ) : canVisit ? (
            <Link
              to={href!}
              className={`inline-flex items-center gap-1 text-xs uppercase tracking-wider font-medium ${
                thumbnail ? "text-white hover:text-white/80" : "text-primary hover:text-primary/80"
              }`}
            >
              {variant === "landing"
                ? "View Course"
                : completed
                  ? "Review"
                  : pct > 0
                    ? "Continue"
                    : "Start"}
              <ArrowRight className="w-3 h-3" />
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled aria-label="Available soon">
              Available soon
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
