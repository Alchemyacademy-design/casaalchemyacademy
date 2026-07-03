import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export interface ActivityStats {
  completedThisWeek: number;
  streakDays: number;
  perDay: Array<{ date: string; count: number }>;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function useActivityStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["activity-stats", user?.id ?? null],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<ActivityStats> => {
      const since = new Date();
      since.setDate(since.getDate() - 27);
      const { data, error } = await (
        supabase.from("lesson_progress") as unknown as {
          select: (s: string) => {
            eq: (c: string, v: unknown) => {
              not: (c: string, o: string, v: unknown) => {
                gte: (c: string, v: string) => Promise<{ data: unknown; error: unknown }>;
              };
            };
          };
        }
      )
        .select("completed_at")
        .eq("user_id", user!.id)
        .not("completed_at", "is", null)
        .gte("completed_at", since.toISOString());
      if (error) throw error as Error;
      const rows = (data as Array<{ completed_at: string }>) ?? [];

      const buckets = new Map<string, number>();
      for (let i = 0; i < 28; i += 1) {
        const d = new Date();
        d.setDate(d.getDate() - (27 - i));
        buckets.set(isoDay(d), 0);
      }
      for (const r of rows) {
        const key = isoDay(new Date(r.completed_at));
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      const perDay = Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      const completedThisWeek = rows.filter((r) => new Date(r.completed_at) >= weekStart).length;

      let streak = 0;
      for (let i = 27; i >= 0; i -= 1) {
        const item = perDay[i];
        if (i === 27 && item.count === 0) continue;
        if (item.count > 0) streak += 1;
        else if (i < 27) break;
      }

      return { completedThisWeek, streakDays: streak, perDay };
    },
  });
}