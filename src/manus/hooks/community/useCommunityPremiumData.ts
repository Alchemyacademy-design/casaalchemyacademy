import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CommunityAuthorProfile = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_path: string | null;
};

const sortedKey = (values: Array<string | number>) => [...new Set(values)].sort().join(",");

export function useCommunityAuthorProfiles(authorIds: string[]) {
  const ids = [...new Set(authorIds.filter(Boolean))];
  return useQuery({
    queryKey: ["community", "author-profiles", sortedKey(ids)],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, avatar_path")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as CommunityAuthorProfile[];
    },
  });
}

export function useCommunityReplyCounts(postIds: number[]) {
  const ids = [...new Set(postIds.filter(Boolean))];
  return useQuery({
    queryKey: ["community", "reply-counts", sortedKey(ids)],
    enabled: ids.length > 0,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_replies")
        .select("post_id")
        .in("post_id", ids)
        .is("deleted_at", null);
      if (error) throw error;
      const counts: Record<number, number> = {};
      for (const row of data ?? []) counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
      return counts;
    },
  });
}

type ModerationPatch = {
  id: number;
  channelId: number;
  patch: {
    pinned?: boolean;
    locked?: boolean;
    hidden_at?: string | null;
  };
  action: string;
  moderatorId: string;
  reason?: string;
};

export function useModerateCommunityPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ModerationPatch) => {
      const { data, error } = await supabase
        .from("community_posts")
        .update(input.patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;

      const { error: auditError } = await supabase.from("moderation_actions").insert({
        action: input.action,
        reason: input.reason ?? null,
        moderator_id: input.moderatorId,
        post_id: input.id,
        reply_id: null,
      });
      if (auditError) throw auditError;
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["community", "posts", input.channelId] });
      queryClient.invalidateQueries({ queryKey: ["community", "reply-counts"] });
    },
  });
}
