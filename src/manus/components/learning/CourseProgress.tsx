import { Progress } from "@/components/ui/progress";

export type CourseProgressProps = {
  completed: number;
  total: number;
  label?: string;
  className?: string;
};

export default function CourseProgress({ completed, total, label, className }: CourseProgressProps) {
  const safeTotal = Math.max(0, total | 0);
  const safeDone = Math.min(Math.max(0, completed | 0), safeTotal);
  const pct = safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100);
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-foreground/60">
          {label ?? "Progress"}
        </span>
        <span className="text-xs font-mono text-foreground/80">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" aria-label={`Progress ${pct}%`} />
      <p className="text-[11px] text-foreground/55 mt-2">
        {safeDone} of {safeTotal} {safeTotal === 1 ? "lesson" : "lessons"} complete
      </p>
    </div>
  );
}
