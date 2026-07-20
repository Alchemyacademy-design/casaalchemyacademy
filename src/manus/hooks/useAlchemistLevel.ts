import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export type AlchemistTier = "Novice" | "Apprentice" | "Alchemist" | "Master" | "Luminary";

export interface AlchemistStats {
  xp: number;
  tier: AlchemistTier;
  next_tier: AlchemistTier | null;
  next_tier_at: number | null;
  current_tier_floor: number;
  rank_all: number | null;
  rank_30d: number | null;
  opt_out: boolean;
  breakdown: {
    lessons: number;
    quizzes: number;
    community_posts: number;
    community_replies: number;
    certificates: number;
  };
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  xp: number;
  tier: AlchemistTier;
  rank: number;
}

export function useMyAlchemistStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["alchemist", "me", user?.id ?? null],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<AlchemistStats | null> => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>)("get_my_alchemist_stats");
      if (error) throw error as Error;
      return (data as AlchemistStats | null) ?? null;
    },
  });
}

export function useAlchemistLeaderboard(window: "all" | "30d") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["alchemist", "leaderboard", window],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>)("get_alchemist_leaderboard", {
        p_window: window,
        p_limit: 10,
      });
      if (error) throw error as Error;
      return (data as LeaderboardEntry[]) ?? [];
    },
  });
}