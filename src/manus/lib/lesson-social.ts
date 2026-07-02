import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// PostgREST typed facade doesn't expose lesson_comments/lesson_ratings until
// types.ts regen; use an untyped alias to keep the file compiling.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

// -------------------- Types --------------------

export type LessonCommentRow = {
  id: number;
  lesson_id: number;
  course_id: number | null;
  user_id: string;
  parent_id: number | null;
  body: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    avatar_path: string | null;
  } | null;
};

export type LessonRatingSummary = {
  avg: number;
  total: number;
  mine: number | null;
};

// -------------------- Comments --------------------

async function fetchComments(lessonId: number): Promise<LessonCommentRow[]> {
  const { data, error } = await db
    .from("lesson_comments")
    .select("id,lesson_id,course_id,user_id,parent_id,body,is_hidden,created_at,updated_at")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as LessonCommentRow[];
  if (!rows.length) return rows;

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,avatar_path")
    .in("id", userIds);
  if (pErr) throw pErr;
  const map = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      full_name: string | null;
      avatar_path: string | null;
    }>).map((p) => [p.id, p]),
  );
  return rows.map((r) => ({ ...r, author: map.get(r.user_id) ?? null }));
}

export function useLessonComments(lessonId: number | null | undefined) {
  return useQuery({
    queryKey: ["lesson-comments", lessonId ?? 0],
    enabled: !!lessonId && lessonId > 0,
    queryFn: () => fetchComments(lessonId as number),
  });
}

export function useCreateLessonComment(lessonId: number, courseId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId?: number | null }) => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Comment cannot be empty");
      if (trimmed.length > 4000) throw new Error("Comment is too long");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");
      const { data, error } = await db
        .from("lesson_comments")
        .insert({
          lesson_id: lessonId,
          course_id: courseId,
          user_id: user.id,
          parent_id: parentId ?? null,
          body: trimmed,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LessonCommentRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
    },
  });
}

export function useDeleteLessonComment(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await db.from("lesson_comments").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
    },
  });
}

export function useToggleHideLessonComment(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hide }: { id: number; hide: boolean }) => {
      const { error } = await db
        .from("lesson_comments")
        .update({ is_hidden: hide })
        .eq("id", id);
      if (error) throw error;
      return { id, hide };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
    },
  });
}

// -------------------- Ratings --------------------

async function fetchRatingSummary(lessonId: number): Promise<LessonRatingSummary> {
  const { data, error } = await db.rpc("lesson_rating_summary", { p_lesson_id: lessonId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    avg: Number(row?.avg_rating ?? 0),
    total: Number(row?.total ?? 0),
    mine: row?.user_rating == null ? null : Number(row.user_rating),
  };
}

export function useLessonRating(lessonId: number | null | undefined) {
  return useQuery({
    queryKey: ["lesson-rating", lessonId ?? 0],
    enabled: !!lessonId && lessonId > 0,
    queryFn: () => fetchRatingSummary(lessonId as number),
  });
}

export function useUpsertLessonRating(lessonId: number, courseId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stars, comment }: { stars: number; comment?: string | null }) => {
      if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
        throw new Error("Stars must be between 1 and 5");
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");
      const { error } = await db
        .from("lesson_ratings")
        .upsert(
          {
            user_id: user.id,
            lesson_id: lessonId,
            course_id: courseId,
            stars,
            comment: comment?.trim() || null,
          },
          { onConflict: "lesson_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-rating", lessonId] });
    },
  });
}

// -------------------- Community discussion --------------------

export type LessonDiscussionInput = {
  channelId: number;
  title: string;
  body: string;
  lessonId: number;
  courseId: number | null;
};

export function useCreateLessonDiscussion() {
  return useMutation({
    mutationFn: async (input: LessonDiscussionInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");
      const title = input.title.trim();
      const body = input.body.trim();
      if (!title) throw new Error("Title is required");
      const { data, error } = await db
        .from("community_posts")
        .insert({
          channel_id: input.channelId,
          author_id: user.id,
          title,
          body,
          status: "published",
          source_lesson_id: input.lessonId,
          source_course_id: input.courseId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: number };
    },
  });
}

export function useCommunityChannels() {
  return useQuery({
    queryKey: ["community-channels-with-space"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_channels")
        .select("id,slug,name,community_spaces!inner(id,slug,name)")
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: number;
        slug: string;
        name: string;
        community_spaces:
          | { id: number; slug: string; name: string }
          | Array<{ id: number; slug: string; name: string }>;
      }>;
    },
  });
}

// -------------------- Utility --------------------

export function useIsSubmittingTooFast(cooldownMs = 3000) {
  // Client-side rate limit — returns a guard function that returns false when
  // the caller is submitting again within `cooldownMs`.
  // Kept as a hook so we can migrate to per-mutation cooldowns later without
  // touching call sites.
  let lastAt = 0;
  return useCallback(() => {
    const now = Date.now();
    if (now - lastAt < cooldownMs) return true;
    lastAt = now;
    return false;
  }, [cooldownMs]);
}