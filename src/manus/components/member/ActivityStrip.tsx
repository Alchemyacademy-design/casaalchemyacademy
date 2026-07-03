import { Flame, TrendingUp } from "lucide-react";
import { useActivityStats } from "@/manus/hooks/useActivityStats";

export default function ActivityStrip() {
  const { data } = useActivityStats();
  const perDay = data?.perDay ?? [];
  const max = Math.max(1, ...perDay.map((d) => d.count));

  return (
    <div className="aa-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="aa-eyebrow">This week</p>
          <h3 className="font-serif text-2xl text-primary">
            {data?.completedThisWeek ?? 0} lesson{(data?.completedThisWeek ?? 0) === 1 ? "" : "s"} completed
          </h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          <Flame className="h-3.5 w-3.5" /> {data?.streakDays ?? 0}-day streak
        </div>
      </div>
      <div className="mt-5 grid grid-cols-28 gap-1" style={{ gridTemplateColumns: "repeat(28, minmax(0, 1fr))" }}>
        {perDay.map((d) => {
          const intensity = d.count === 0 ? 0.08 : 0.25 + (d.count / max) * 0.75;
          return (
            <div
              key={d.date}
              className="h-6 rounded-sm bg-accent"
              style={{ opacity: intensity }}
              title={`${d.date}: ${d.count} lesson${d.count === 1 ? "" : "s"}`}
            />
          );
        })}
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <TrendingUp className="h-3 w-3" /> Last 4 weeks
      </p>
    </div>
  );
}