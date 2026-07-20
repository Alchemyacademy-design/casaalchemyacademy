import { Sparkles, BookOpen, Trophy, MessageCircle, Award } from "lucide-react";
import { useMyAlchemistStats } from "@/manus/hooks/useAlchemistLevel";

const TIER_ORDER = ["Novice", "Apprentice", "Alchemist", "Master", "Luminary"] as const;

export default function AlchemistLevelCard() {
  const { data, isLoading } = useMyAlchemistStats();

  if (isLoading || !data) {
    return (
      <div className="aa-panel p-6">
        <p className="aa-eyebrow">Alchemist Level</p>
        <p className="mt-3 text-sm text-muted-foreground">Calculating your XP…</p>
      </div>
    );
  }

  const floor = data.current_tier_floor;
  const ceiling = data.next_tier_at ?? Math.max(data.xp, floor + 1);
  const range = Math.max(1, ceiling - floor);
  const inTier = Math.max(0, data.xp - floor);
  const pct = data.next_tier_at ? Math.min(100, Math.round((inTier / range) * 100)) : 100;
  const toNext = data.next_tier_at ? Math.max(0, data.next_tier_at - data.xp) : 0;

  return (
    <div className="aa-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="aa-eyebrow inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Alchemist Level
          </p>
          <h3 className="mt-1 font-serif text-3xl leading-tight text-primary">{data.tier}</h3>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {data.xp.toLocaleString()} XP
            {data.next_tier ? (
              <> · {toNext.toLocaleString()} to {data.next_tier}</>
            ) : (
              <> · Highest tier reached</>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {data.rank_all ? <span className="text-accent">All-time #{data.rank_all}</span> : <span>Unranked all-time</span>}
          {data.rank_30d ? <span className="text-accent">30-day #{data.rank_30d}</span> : <span>Unranked 30d</span>}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {TIER_ORDER.map((t) => (
              <span key={t} className={t === data.tier ? "text-accent" : "opacity-40"}>
                {t.slice(0, 1)}
              </span>
            ))}
          </div>
          <span>{pct}%</span>
        </div>
        <div className="aa-progress-track">
          <div className="aa-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BreakdownItem icon={<BookOpen className="h-3.5 w-3.5" />} label="Lessons" value={data.breakdown.lessons} />
        <BreakdownItem icon={<Trophy className="h-3.5 w-3.5" />} label="Quizzes" value={data.breakdown.quizzes} />
        <BreakdownItem
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          label="Community"
          value={data.breakdown.community_posts + data.breakdown.community_replies}
        />
        <BreakdownItem icon={<Award className="h-3.5 w-3.5" />} label="Certificates" value={data.breakdown.certificates} />
      </dl>
    </div>
  );
}

function BreakdownItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-secondary/40 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-accent">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 font-serif text-lg text-primary">{value.toLocaleString()}</dd>
    </div>
  );
}