import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Lock, PlayCircle } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import VideoPreview from "@/manus/components/admin/VideoPreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";
import { trpc } from "@/manus/lib/trpc";
import { toast } from "sonner";

type Lesson = {
  id: number;
  module_id: number;
  title: string;
  description: string | null;
  content_text: string | null;
  external_video_url: string | null;
  external_resource_url: string | null;
  duration_seconds: number | null;
  is_preview: boolean | null;
  status: "draft" | "published" | "archived";
  sort_order: number;
};

type Module = {
  id: number;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  sort_order: number;
  lessons: Lesson[];
};

type Course = {
  id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  cover_image_path: string | null;
  status: "draft" | "published" | "archived";
  access_plan_keys: string[] | null;
  course_modules: Module[];
};

async function fetchCourseTree(id: number, includeDrafts: boolean): Promise<Course | null> {
  let builder = supabase
    .from("courses")
    .select(
      "id,title,slug,subtitle,description,cover_image_path,status,access_plan_keys," +
        "course_modules(id,title,description,status,sort_order," +
        "lessons(id,module_id,title,description,content_text,external_video_url,external_resource_url,duration_seconds,is_preview,status,sort_order))",
    )
    .eq("id", id);
  if (!includeDrafts) builder = builder.eq("status", "published");
  const { data, error } = await builder
    .order("sort_order", { foreignTable: "course_modules", ascending: true })
    .order("sort_order", { foreignTable: "course_modules.lessons", ascending: true })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const course = data as unknown as Course;
  if (!includeDrafts) {
    course.course_modules = course.course_modules
      .filter((m) => m.status === "published")
      .map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.status === "published") }));
  }
  return course;
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();

  const { data: course, isLoading, error } = useQuery({
    queryKey: ["public", "course", courseId, { admin: isAdmin }],
    queryFn: () => fetchCourseTree(courseId, isAdmin),
    enabled: Number.isFinite(courseId),
  });

  const tier = (user as { membershipTier?: string } | null)?.membershipTier ?? "guest";
  const isFullMember = isAdmin || tier === "annual_member" || tier === "monthly_member";
  const accessible =
    !course ||
    isFullMember ||
    !(course.access_plan_keys?.length) ||
    course.access_plan_keys.includes("free") ||
    course.access_plan_keys.includes("guest");

  const allLessons: Lesson[] = useMemo(
    () => (course?.course_modules ?? []).flatMap((m) => m.lessons),
    [course],
  );

  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  useEffect(() => {
    if (activeLessonId == null && allLessons.length > 0) {
      const firstPlayable = allLessons.find((l) => l.is_preview || accessible) ?? allLessons[0];
      setActiveLessonId(firstPlayable.id);
    }
  }, [allLessons, activeLessonId, accessible]);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? null;
  const activeModule = course?.course_modules.find((m) => m.id === activeLesson?.module_id) ?? null;

  const { data: progress = [] } = trpc.lessons.progress.useQuery({ lessonId: 0 });
  const completedIds = useMemo(
    () => new Set(progress.filter((p) => p.completed).map((p) => p.lessonId)),
    [progress],
  );

  const markLesson = trpc.lessons.markComplete.useMutation({
    onSuccess: async () => {
      toast.success("Marked as complete");
      await qc.invalidateQueries({ queryKey: [["lessons", "progress"]] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!Number.isFinite(courseId)) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-foreground/70">Invalid course id.</div>
      </MemberLayout>
    );
  }

  if (isLoading) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-foreground/70">Loading course…</div>
      </MemberLayout>
    );
  }

  if (error) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-destructive">Failed to load course: {(error as Error).message}</div>
      </MemberLayout>
    );
  }

  if (!course) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-foreground/70">
          Course not found or not published yet.{" "}
          <Link to="/mycourses" className="underline">Back to courses</Link>
        </div>
      </MemberLayout>
    );
  }

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => completedIds.has(l.id)).length;
  const progressPercent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

  const lessonPlayable = (l: Lesson) => accessible || l.is_preview;

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <div className="mb-6">
          <Link to="/mycourses" className="text-xs inline-flex items-center gap-1 text-foreground/60 hover:text-foreground">
            <ArrowLeft className="w-3 h-3" /> All courses
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div>
            <div className="mb-6">
              <p className="section-label mb-2">Course</p>
              <h1 className="font-serif text-3xl md:text-4xl mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
                {course.title}
              </h1>
              {course.subtitle && (
                <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>{course.subtitle}</p>
              )}
              {course.status !== "published" && (
                <span className="inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                  {course.status}
                </span>
              )}
            </div>

            {!accessible && (
              <Card className="p-4 mb-6 border-amber-200 bg-amber-50/60 flex items-start gap-3">
                <Lock className="w-4 h-4 mt-0.5 text-amber-700" />
                <div className="text-sm text-amber-900">
                  This course requires a membership.{" "}
                  <Link to="/#pricing" className="underline">View plans</Link>. Preview lessons are still available.
                </div>
              </Card>
            )}

            {activeLesson ? (
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden bg-black/90">
                  {lessonPlayable(activeLesson) ? (
                    <VideoPreview url={activeLesson.external_video_url} />
                  ) : (
                    <div className="aspect-video flex items-center justify-center text-white/80 text-sm">
                      <Lock className="w-5 h-5 mr-2" /> Locked — upgrade to watch
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-foreground/50">{activeModule?.title}</p>
                  <h2 className="font-serif text-2xl mt-1" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                    {activeLesson.title}
                  </h2>
                  {activeLesson.description && (
                    <p className="text-sm text-foreground/70 mt-2 leading-relaxed">{activeLesson.description}</p>
                  )}
                </div>
                {activeLesson.content_text && (
                  <Card className="p-5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                    {activeLesson.content_text}
                  </Card>
                )}
                {activeLesson.external_resource_url && (
                  <a
                    href={activeLesson.external_resource_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs underline text-foreground/70"
                  >
                    Open resource ↗
                  </a>
                )}
                {lessonPlayable(activeLesson) && (
                  <div className="pt-2">
                    <Button
                      variant={completedIds.has(activeLesson.id) ? "outline" : "default"}
                      onClick={() =>
                        markLesson.mutate({
                          lessonId: activeLesson.id,
                          completed: !completedIds.has(activeLesson.id),
                        })
                      }
                      disabled={markLesson.isPending}
                    >
                      {completedIds.has(activeLesson.id) ? "Mark as not completed" : "Mark as completed"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Card className="p-6 text-sm text-foreground/60 text-center">
                This course has no lessons yet.
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wider text-foreground/60">Progress</p>
                <p className="text-xs font-mono">{progressPercent}%</p>
              </div>
              <div className="h-1.5 rounded bg-muted overflow-hidden">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-[11px] text-foreground/55 mt-2">
                {completedCount} of {totalLessons} lessons complete
              </p>
            </Card>

            {course.course_modules.length === 0 && (
              <Card className="p-4 text-xs text-foreground/60">No modules published yet.</Card>
            )}

            {course.course_modules.map((m) => (
              <Card key={m.id} className="p-3">
                <p className="text-xs uppercase tracking-wider text-foreground/60 mb-2">{m.title}</p>
                <ul className="space-y-0.5">
                  {m.lessons.map((l) => {
                    const done = completedIds.has(l.id);
                    const playable = lessonPlayable(l);
                    const active = l.id === activeLessonId;
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => setActiveLessonId(l.id)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded text-xs transition ${
                            active ? "bg-muted font-medium" : "hover:bg-muted/50"
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : playable ? (
                            <PlayCircle className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                          )}
                          <span className="truncate flex-1">{l.title}</span>
                          {l.is_preview && !accessible && (
                            <span className="text-[9px] uppercase tracking-wider text-emerald-700">free</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                  {m.lessons.length === 0 && (
                    <li className="text-[11px] text-foreground/50 px-2 py-1">No lessons.</li>
                  )}
                </ul>
              </Card>
            ))}

            {isAdmin && (
              <Link
                to={`/admin/courses/${course.id}`}
                className="block text-center text-xs underline text-foreground/60"
              >
                Manage in admin →
              </Link>
            )}
          </aside>
        </div>
      </div>
    </MemberLayout>
  );
}
