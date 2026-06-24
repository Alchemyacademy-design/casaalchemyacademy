type Props = {
  current: number; // 1-indexed
  total: number;
  passingScore?: number;
};

export default function QuizProgress({ current, total, passingScore }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-foreground/60">
        <span>
          Question {current} of {total}
        </span>
        {passingScore != null && <span>Passing score: {passingScore}%</span>}
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
