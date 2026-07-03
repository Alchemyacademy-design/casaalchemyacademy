import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = (channelIds: number[]) => ["community", "unread", channelIds.slice().sort().join(",")];

export function useChannelUnread(channelIds: number[], userId: string | null) {
  const enabled = !!userId && channelIds.length > 0;
  return useQuery({
    queryKey: KEY(channelIds),
    enabled,
    queryFn: async () => {
      const [readsRes, postsRes] = await Promise.all([
        supabase.from("community_reads").select("channel_id,last_read_at").in("channel_id", channelIds).eq("user_id", userId!),
        supabase.from("community_posts").select("channel_id,created_at").in("channel_id", channelIds),
      ]);
      if (readsRes.error) throw readsRes.error;
      if (postsRes.error) throw postsRes.error;
      const reads = new Map<number, string>((readsRes.data ?? []).map((r: any) => [Number(r.channel_id), r.last_read_at]));
      const counts: Record<number, number> = {};
      for (const p of (postsRes.data ?? []) as Array<{ channel_id: number; created_at: string }>) {
        const cid = Number(p.channel_id);
        const last = reads.get(cid);
        if (!last || new Date(p.created_at) > new Date(last)) {
          counts[cid] = (counts[cid] ?? 0) + 1;
        }
      }
      return counts;
    },
    staleTime: 30_000,
  });
}

export function useMarkChannelRead(userId: string | null) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (channelId: number) => {
      if (!userId) return;
      await supabase.from("community_reads").upsert(
        { user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,channel_id" },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", "unread"] });
    },
  });
  return mutation;
}

export function useMarkChannelReadEffect(channelId: number | null, userId: string | null) {
  const { mutate } = useMarkChannelRead(userId);
  useEffect(() => {
    if (!channelId || !userId) return;
    const t = setTimeout(() => mutate(channelId), 800);
    return () => clearTimeout(t);
  }, [channelId, userId, mutate]);
}
