import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar, StatusPill } from "@/manus/components/member/MemberUI";
import { resolveAssetUrl } from "@/manus/lib/asset-url";

export type CourseCardData = {
  id: number;
  title: string;
  subtitle?: string | null;
  number?: number | string | null;
  thumbnail?: string | null;
  lessonCount?: number;
  progressPercent?: number;
  published?: boolean;
  comingSoon?: boolean;
  locked?: boolean;
  href?: string;
  adminPreview?: boolean;
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
    adminPreview = false,
  } = course;

  const percent = Math.max(0, Math.min(100, progressPercent ?? 0));
  const thumbnailUrl = resolveAssetUrl(thumbnail);
  const numberLabel =
    number == null ? null : typeof number === "number" ? String(number).padStart(2, "0") : number;
  const completed = percent === 100;
  const isLanding = variant === "landing";
  const canVisit = Boolean(href && !comingSoon && !isLanding);


  const content = (
    <article
      data-testid="aa-course-card"
      data-variant={variant}
      className={`aa-course-card group relative flex h-full min-h-[310px] flex-col overflow-hidden border border-border/70 bg-card transition duration-300 ${
        isLanding ? "rounded-none hover:-translate-y-1 hover:shadow-editorial" : "rounded-xl hover:-translate-y-1 hover:border-accent/30 hover:shadow-float"
      }`}
    >
      <div className="relative min-h-[170px] overflow-hidden bg-primary">
        {thumbnailUrl ? (
          <div
            className="absolute inset-0 scale-[1.01] bg-cover bg-center transition duration-500 group-hover:scale-[1.045]"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 75% 20%, hsl(var(--accent) / .52), transparent 38%), linear-gradient(135deg, hsl(var(--primary)), hsl(20 63% 11%))",
            }}
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/15 to-transparent" aria-hidden="true" />
        <div className="relative z-10 flex min-h-[170px] flex-col justify-between p-5 text-primary-foreground">
          <div className="flex items-start justify-between gap-3">
            {numberLabel != null ? <span className="font-serif text-3xl leading-none">{numberLabel}</span> : <span />}
            <div className="flex flex-wrap justify-end gap-1.5">
              {adminPreview ? <StatusPill tone="warning">Admin Preview</StatusPill> : null}
              {!published ? <StatusPill tone="warning">Draft</StatusPill> : null}
              {comingSoon && !isLanding ? <StatusPill>Coming Soon</StatusPill> : null}
              {locked || comingSoon ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/25 backdrop-blur" aria-label="Locked">
                  <Lock className="h-4 w-4" />
                </span>
              ) : null}
              {completed && !locked ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/90 text-white" aria-label="Completed">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {isLanding
              ? comingSoon
                ? ""
                : "Course preview"
              : locked
              ? "Membership access"
              : completed
              ? "Course complete"
              : percent > 0
              ? "Continue learning"
              : "Your next course"}
          </p>

        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-serif text-[1.7rem] leading-[1.03] text-primary">{title}</h3>
        {subtitle ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}

        <div className="mt-auto pt-6">
          {!isLanding && !locked && !comingSoon && typeof lessonCount === "number" ? (
            <ProgressBar value={percent} label={`${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`} />
          ) : (
            <div className="mb-4 text-xs text-muted-foreground">
              {!isLanding && typeof lessonCount === "number"
                ? `${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`
                : isLanding
                ? "Included in membership"
                : "Course details"}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {isLanding
                ? comingSoon
                  ? "Coming soon"
                  : "AVAILABLE WITH SUBSCRIPTION OR SOLD INDIVIDUALLY"
                : comingSoon
                ? "Coming soon"
                : locked
                ? "Locked"
                : completed
                ? "Completed"
                : percent > 0
                ? `${percent}% done`
                : "Ready to begin"}
            </span>
            {isLanding ? (
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {comingSoon ? "Coming soon" : "Preview"}
              </span>
            ) : comingSoon ? (
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Coming soon</span>
            ) : canVisit ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                {locked ? "View plans" : completed ? "Review" : percent > 0 ? "Continue" : "Start"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            ) : (
              <Button variant="outline" size="sm" disabled aria-label="Available soon">
                Available soon
              </Button>
            )}
          </div>
        </div>

      </div>
    </article>
  );

  return canVisit ? (
    <Link to={href!} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
      {content}
    </Link>
  ) : (
    content
  );
}
