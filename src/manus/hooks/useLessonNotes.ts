import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export interface LessonNote {
  id: string;
  lesson_id: number;
  body: string;
  position_seconds: number | null;
  updated_at: string;
}

const KEY = (userId: string | null | undefined, lessonId: number | null) =>
  ["lesson-note", userId ?? null, lessonId] as const;

export function useLessonNote(lessonId: number | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY(user?.id, lessonId),
    enabled: !!user?.id && !!lessonId,
    staleTime: 30_000,
    queryFn: async (): Promise<LessonNote | null> => {
      const { data, error } = await (
        supabase.from("lesson_notes" as never) as unknown as {
          select: (s: string) => {
            eq: (c: string, v: unknown) => {
              eq: (c: string, v: unknown) => {
                maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
              };
            };
          };
        }
      )
        .select("id,lesson_id,body,position_seconds,updated_at")
        .eq("user_id", user!.id)
        .eq("lesson_id", lessonId!)
        .maybeSingle();
      if (error) throw error as Error;
      return (data as LessonNote | null) ?? null;
    },
  });
}

export function useSaveLessonNote(lessonId: number | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!user?.id || !lessonId) throw new Error("Not ready");
      const { error } = await (supabase as unknown as {
        from: (t: string) => {
          upsert: (
            v: Record<string, unknown>,
            o: { onConflict: string },
          ) => Promise<{ error: unknown }>;
        };
      })
        .from("lesson_notes")
        .upsert(
          { user_id: user.id, lesson_id: lessonId, body },
          { onConflict: "user_id,lesson_id" },
        );
      if (error) throw error as Error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.id, lessonId) }),
  });
}