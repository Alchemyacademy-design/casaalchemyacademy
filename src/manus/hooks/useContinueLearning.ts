import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export interface ContinueLearningItem {
  lessonId: number;
  lessonTitle: string;
  moduleId: number;
  moduleTitle: string;
  courseId: number;
  courseTitle: string;
  courseSlug: string | null;
  thumbnail: string | null;
  watchedPercent: number;
  watchedSeconds: number;
  lastWatchedAt: string;
  href: string;
}

/**
 * Returns the member's most recently watched incomplete lesson,
 * plus a small backlog of "next up" lessons across active courses.
 */
export function useContinueLearning() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["continue-learning", user?.id ?? null],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<{ resume: ContinueLearningItem | null; upNext: ContinueLearningItem[] }> => {
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (c: string, v: unknown) => {
              is: (c: string, v: unknown) => {
                order: (c: string, o: { ascending: boolean }) => {
                  limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
                };
              };
            };
          };
        };
      };
      const { data, error } = await client
        .from("lesson_progress")
        .select(
          "lesson_id, watched_seconds, watched_percent, completed_at, last_watched_at, lessons:lesson_id ( id, title, module_id, course_modules:module_id ( id, title, course_id, cover_image_path, courses:course_id ( id, title, slug, cover_image_path ) ) )",
        )
        .eq("user_id", user!.id)
        .is("completed_at", null)
        .order("last_watched_at", { ascending: false })
        .limit(8);
      if (error) throw error as Error;
      const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
      const items: ContinueLearningItem[] = [];
      for (const row of rows) {
        const lesson = row.lessons as
          | {
              id: number;
              title: string;
              module_id: number;
              course_modules?: {
                id: number;
                title: string;
                course_id: number;
                cover_image_path: string | null;
                courses?: { id: number; title: string; slug: string | null; cover_image_path: string | null } | null;
              } | null;
            }
          | null;
        const mod = lesson?.course_modules ?? null;
        const course = mod?.courses ?? null;
        if (!lesson || !mod || !course) continue;
        items.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleId: mod.id,
          moduleTitle: mod.title,
          courseId: course.id,
          courseTitle: course.title,
          courseSlug: course.slug,
          thumbnail: mod.cover_image_path ?? course.cover_image_path ?? null,
          watchedPercent: Number(row.watched_percent ?? 0),
          watchedSeconds: Number(row.watched_seconds ?? 0),
          lastWatchedAt: (row.last_watched_at as string) ?? "",
          href: `/modules/${mod.id}?lesson=${lesson.id}`,
        });
      }
      return { resume: items[0] ?? null, upNext: items.slice(1, 4) };
    },
  });
}