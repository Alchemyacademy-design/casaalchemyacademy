import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export type ModuleCardProps = {
  id: number;
  title: string;
  description?: string | null;
  lessonCount: number;
  completedCount?: number;
  href: string;
  badge?: string;
};

export default function ModuleCard({
  title,
  description,
  lessonCount,
  completedCount = 0,
  href,
  badge,
}: ModuleCardProps) {
  return (
    <Link
      to={href}
      className="block rounded-lg border border-border/50 bg-card/40 p-4 transition hover:border-border hover:bg-card/60"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-serif text-lg text-foreground">{title}</h3>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="text-xs text-foreground/65 mb-3 line-clamp-3">{description}</p>}
      <div className="flex items-center justify-between text-[11px] text-foreground/60">
        <span>
          {completedCount}/{lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
        </span>
        <span className="inline-flex items-center gap-1 text-primary">
          Open <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}
