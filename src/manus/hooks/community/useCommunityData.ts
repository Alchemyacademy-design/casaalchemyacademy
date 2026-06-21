import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CommunitySpace = Database["public"]["Tables"]["community_spaces"]["Row"];
export type CommunitySpaceUpdate = Database["public"]["Tables"]["community_spaces"]["Update"];
export type CommunityChannel = Database["public"]["Tables"]["community_channels"]["Row"];
export type CommunityChannelUpdate = Database["public"]["Tables"]["community_channels"]["Update"];
export type CommunityPost = Database["public"]["Tables"]["community_posts"]["Row"];
export type CommunityReply = Database["public"]["Tables"]["community_replies"]["Row"];
export type CommunityReaction = Database["public"]["Tables"]["community_reactions"]["Row"];

const SPACES_KEY = ["community", "spaces"] as const;
const channelsKey = (spaceId: number | null) => ["community", "channels", spaceId] as const;
const postsKey = (channelId: number | null) => ["community", "posts", channelId] as const;
const repliesKey = (postId: number | null) => ["community", "replies", postId] as const;
const reactionsKey = (postId: number | null) => ["community", "reactions", "post", postId] as const;
const replyReactionsKey = (postId: number | null) => ["community", "reactions", "replies", postId] as const;

/* ----------------------------- Spaces ----------------------------- */

export function useSpaces() {
  return useQuery({
    queryKey: SPACES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_spaces")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; description?: string }) => {
      const { data, error } = await supabase
        .from("community_spaces")
        .insert({
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          status: "published",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SPACES_KEY }),
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; patch: CommunitySpaceUpdate }) => {
      const { data, error } = await supabase
        .from("community_spaces")
        .update(input.patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SPACES_KEY }),
  });
}

export function useDeleteSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("community_spaces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SPACES_KEY }),
  });
}

/* ----------------------------- Channels ----------------------------- */

export function useChannels(spaceId: number | null) {
  return useQuery({
    queryKey: channelsKey(spaceId),
    enabled: !!spaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_channels")
        .select("*")
        .eq("space_id", spaceId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateChannel(spaceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; description?: string }) => {
      if (!spaceId) throw new Error("Select a space first");
      const { data, error } = await supabase
        .from("community_channels")
        .insert({
          space_id: spaceId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          status: "published",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: channelsKey(spaceId) }),
  });
}

export function useUpdateChannel(spaceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; patch: CommunityChannelUpdate }) => {
      const { data, error } = await supabase
        .from("community_channels")
        .update(input.patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: channelsKey(spaceId) }),
  });
}

export function useDeleteChannel(spaceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("community_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: channelsKey(spaceId) }),
  });
}

/* ----------------------------- Posts ----------------------------- */

export function usePosts(channelId: number | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: postsKey(channelId),
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .eq("channel_id", channelId!)
        .is("deleted_at", null)
        .order("pinned", { ascending: false })
        .order("last_activity_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: insert / update / delete on this channel
  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`community_posts:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_posts", filter: `channel_id=eq.${channelId}` },
        () => {
          qc.invalidateQueries({ queryKey: postsKey(channelId) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, qc]);

  return query;
}

export function useCreatePost(channelId: number | null, authorId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; body: string }) => {
      if (!channelId) throw new Error("Pick a channel");
      if (!authorId) throw new Error("You must be signed in");
      const { data, error } = await supabase
        .from("community_posts")
        .insert({
          channel_id: channelId,
          author_id: authorId,
          title: input.title.trim() || input.body.slice(0, 60),
          body: input.body,
          status: "published",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: postsKey(channelId) }),
  });
}

export function useDeletePost(channelId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("community_posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: postsKey(channelId) }),
  });
}

export function useTogglePinPost(channelId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; pinned: boolean }) => {
      const { error } = await supabase
        .from("community_posts")
        .update({ pinned: input.pinned })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: postsKey(channelId) }),
  });
}

/* ----------------------------- Replies ----------------------------- */

export function useReplies(postId: number | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: repliesKey(postId),
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_replies")
        .select("*")
        .eq("post_id", postId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`community_replies:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_replies", filter: `post_id=eq.${postId}` },
        () => qc.invalidateQueries({ queryKey: repliesKey(postId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, qc]);

  return query;
}

export function useCreateReply(postId: number | null, authorId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!postId) throw new Error("Pick a post");
      if (!authorId) throw new Error("You must be signed in");
      const { data, error } = await supabase
        .from("community_replies")
        .insert({
          post_id: postId,
          author_id: authorId,
          body,
          status: "published",
        })
        .select()
        .single();
      if (error) throw error;
      // bump last_activity_at on parent post (best-effort, ignored if not author/admin)
      await supabase
        .from("community_posts")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", postId);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: repliesKey(postId) }),
  });
}

export function useDeleteReply(postId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("community_replies")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: repliesKey(postId) }),
  });
}

/* ----------------------------- Reactions ----------------------------- */

export function usePostReactions(postIds: number[]) {
  return useQuery({
    queryKey: ["community", "reactions", "by-posts", postIds.slice().sort().join(",")],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_reactions")
        .select("*")
        .in("post_id", postIds);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReplyReactions(replyIds: number[]) {
  return useQuery({
    queryKey: ["community", "reactions", "by-replies", replyIds.slice().sort().join(",")],
    enabled: replyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_reactions")
        .select("*")
        .in("reply_id", replyIds);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      reaction: string;
      userId: string;
      postId?: number;
      replyId?: number;
    }) => {
      const filter = input.postId ? { post_id: input.postId } : { reply_id: input.replyId! };
      const { data: existing, error: selErr } = await supabase
        .from("community_reactions")
        .select("id")
        .match({ ...filter, user_id: input.userId, reaction: input.reaction })
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error } = await supabase
          .from("community_reactions")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { removed: true };
      }
      const { error } = await supabase.from("community_reactions").insert({
        user_id: input.userId,
        reaction: input.reaction,
        post_id: input.postId ?? null,
        reply_id: input.replyId ?? null,
      });
      if (error) throw error;
      return { removed: false };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", "reactions"] });
    },
  });
}

/* ----------------------------- Moderation ----------------------------- */

export function useLogModeration() {
  return useMutation({
    mutationFn: async (input: {
      action: string;
      reason?: string;
      moderatorId: string;
      postId?: number;
      replyId?: number;
    }) => {
      const { error } = await supabase.from("moderation_actions").insert({
        action: input.action,
        reason: input.reason ?? null,
        moderator_id: input.moderatorId,
        post_id: input.postId ?? null,
        reply_id: input.replyId ?? null,
      });
      if (error) throw error;
    },
  });
}

export const communityKeys = {
  spaces: SPACES_KEY,
  channels: channelsKey,
  posts: postsKey,
  replies: repliesKey,
  postReactions: reactionsKey,
  replyReactions: replyReactionsKey,
};
