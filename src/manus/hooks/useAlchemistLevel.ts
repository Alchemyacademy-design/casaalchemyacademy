import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export type AlchemistTier =
  | "Prima Materia"
  | "Awakening"
  | "Refinement"
  | "Mastery"
  | "Philosopher's Stone";

export const ALCHEMIST_TIERS: {
  name: AlchemistTier;
  short: string;
  from: number;
  blurb: string;
}[] = [
  {
    name: "Prima Materia",
    short: "PM",
    from: 0,
    blurb: "The raw material. You are starting the work — first lessons, first steps.",
  },
  {
    name: "Awakening",
    short: "AW",
    from: 100,
    blurb: "The eye opens. You start seeing colour, light and proportion with intention.",
  },
  {
    name: "Refinement",
    short: "RF",
    from: 500,
    blurb: "The true alchemy: refining the raw into the considered. Choosing better, not more.",
  },
  {
    name: "Mastery",
    short: "MA",
    from: 1500,
    blurb: "The craft is yours. You design with confidence and teach others in the community.",
  },
  {
    name: "Philosopher's Stone",
    short: "PS",
    from: 4000,
    blurb: "The final stage. You transform any space — and everyone around you feels it.",
  },
];

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