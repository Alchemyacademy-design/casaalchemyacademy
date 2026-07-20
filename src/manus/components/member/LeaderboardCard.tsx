import { useState } from "react";
import { Trophy } from "lucide-react";
import UserAvatar from "@/manus/components/UserAvatar";
import { useAlchemistLeaderboard, useMyAlchemistStats } from "@/manus/hooks/useAlchemistLevel";
import { useAuth } from "@/manus/hooks/useAuth";

type WindowKey = "all" | "30d";

export default function LeaderboardCard() {
  const [win, setWin] = useState<WindowKey>("all");
  const { user } = useAuth();
  const { data: entries = [], isLoading } = useAlchemistLeaderboard(win);
  const { data: me } = useMyAlchemistStats();
  const myRank = win === "all" ? me?.rank_all ?? null : me?.rank_30d ?? null;
  const meInTop = entries.some((entry) => entry.user_id === user?.id);

  return (
    <div className="aa-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="aa-eyebrow inline-flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Leaderboard
          </p>
          <h3 className="mt-1 font-serif text-2xl leading-tight text-primary">Top Alchemists</h3>
        </div>
        <div className="inline-flex overflow-hidden rounded-full border border-border text-[11px] font-semibold uppercase tracking-[0.12em]">
          <button
            type="button"
            onClick={() => setWin("all")}
            className={`px-3 py-1.5 transition ${win === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            All-time
          </button>
          <button
            type="button"
            onClick={() => setWin("30d")}
            className={`px-3 py-1.5 transition ${win === "30d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            30 days
          </button>
        </div>
      </div>

      <ol className="mt-5 space-y-1">
        {isLoading && entries.length === 0 ? (
          <li className="py-6 text-center text-xs text-muted-foreground">Loading ranking…</li>
        ) : entries.length === 0 ? (
          <li className="py-6 text-center text-xs text-muted-foreground">No ranked Alchemists yet — earn XP by completing lessons.</li>
        ) : (
          entries.map((entry) => {
            const isMe = entry.user_id === user?.id;
            return (
              <li
                key={entry.user_id}
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition ${isMe ? "bg-accent/10 ring-1 ring-accent/30" : "hover:bg-secondary/50"}`}
              >
                <span className="w-6 shrink-0 text-center font-serif text-lg text-primary">{entry.rank}</span>
                <UserAvatar name={entry.display_name} avatarPath={entry.avatar_path} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {entry.display_name}
                    {isMe ? <span className="ml-1.5 text-[10px] uppercase tracking-[0.14em] text-accent">You</span> : null}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{entry.tier}</p>
                </div>
                <span className="shrink-0 font-serif text-lg text-primary">{entry.xp.toLocaleString()}</span>
              </li>
            );
          })
        )}
      </ol>

      {!meInTop && myRank ? (
        <p className="mt-4 rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">
          Your position: <span className="font-semibold text-foreground">#{myRank}</span>
        </p>
      ) : null}
      {!myRank && me?.opt_out ? (
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          You've opted out — enable ranking in Profile settings.
        </p>
      ) : null}
    </div>
  );
}