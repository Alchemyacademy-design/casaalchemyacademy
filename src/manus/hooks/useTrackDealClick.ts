import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export function useTrackDealClick() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (dealId: number) => {
      const { error } = await (supabase as unknown as {
        from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> };
      })
        .from("deal_clicks")
        .insert({
          deal_id: dealId,
          user_id: user?.id ?? null,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
        });
      if (error) throw error as Error;
    },
  });
}