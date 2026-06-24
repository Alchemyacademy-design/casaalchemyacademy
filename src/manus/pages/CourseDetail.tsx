import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import QueryStateView from "@/manus/components/QueryStateView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";
import { trpc } from "@/manus/lib/trpc";
import { getCoursesTree } from "@/manus/services/admin-content";
import { canAccessCourse, pickResumeLessonId } from "@/manus/services/learning";
import CourseProgress from "@/manus/components/learning/CourseProgress";
import LearningPath from "@/manus/components/learning/LearningPath";
import LessonMaterial from "@/manus/components/learning/LessonMaterial";
import ModuleCard from "@/manus/components/learning/ModuleCard";
import QuizCard from "@/manus/components/learning/QuizCard";


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
  if (includeDrafts) {
    const catalog = await getCoursesTree();
    return (catalog.courses.find((course) => course.id === id) as unknown as Course | undefined) ?? null;
  }

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

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const { isAdmin, isMember, hasCourseAccess, activeEntitlements } = useAuth();

  const { data: course, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["public", "course", courseId, { admin: isAdmin }],
    queryFn: () => fetchCourseTree(courseId, isAdmin),
    enabled: Number.isFinite(courseId),
    staleTime: 2 * 60 * 1000,
  });
  const isCourseNotFound = !isLoading && !error && course === null;

  const accessState = {
    isAdmin,
    isMember,
    hasCourseAccess,
    entitlementCourseIds: (activeEntitlements ?? []).map((e) => Number(e.course_id)).filter(Boolean),
  };
  const accessible = !course || canAccessCourse(course.id, course.access_plan_keys, accessState);

  const allLessons: Lesson[] = useMemo(
    () => (course?.course_modules ?? []).flatMap((m) => m.lessons),
    [course],
  );

  const { data: progress = [] } = trpc.lessons.progress.useQuery(undefined, { enabled: !isAdmin });
  const completedIds = useMemo(
    () => new Set<number>(progress.filter((p: { completed: boolean; lessonId: number }) => p.completed).map((p) => Number(p.lessonId))),
    [progress],
  );

  // Course-level published quizzes (not bound to a specific lesson).
  const courseQuizzesQuery = useQuery({
    queryKey: ["course-quizzes", courseId],
    enabled: Number.isFinite(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title,status,lesson_id")
        .eq("course_id", courseId)
        .eq("status", "published")
        .is("lesson_id", null);
      if (error) throw error;
      return (data ?? []) as Array<{ id: number; title: string; status: string; lesson_id: number | null }>;
    },
  });



  if (!Number.isFinite(courseId)) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-foreground/70">Invalid course id.</div>
      </MemberLayout>
    );
  }

  if (error) {
    return (
      <MemberLayout>
        <div className="p-6 md:p-10">
          <QueryStateView
            isLoading={false}
            isFetching={isFetching}
            error={error}
            onRetry={() => refetch()}
            errorTitle="Failed to load course"
          >
            <></>
          </QueryStateView>
        </div>
      </MemberLayout>
    );
  }

  if (isLoading) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-foreground/70" role="status" aria-busy="true">
          Loading course…
        </div>
      </MemberLayout>
    );
  }

  if (isCourseNotFound || !course) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-foreground/70">
          Course unavailable or you do not have access.{" "}
          <Link to="/mycourses" className="underline">Back to courses</Link>
        </div>
      </MemberLayout>
    );
  }


  const totalModules = course.course_modules.length;
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => completedIds.has(l.id)).length;
  const totalDurationSeconds = allLessons.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);
  const durationLabel = formatDuration(totalDurationSeconds);

  const resumeLessonId = pickResumeLessonId(
    allLessons,
    progress as Array<{ lessonId: number; completed: boolean; last_watched_at?: string | null }>,
  );
  const resumeLesson = allLessons.find((l) => l.id === resumeLessonId) ?? allLessons[0] ?? null;
  const startHref = resumeLesson
    ? `/modules/${resumeLesson.module_id}#lesson-${resumeLesson.id}`
    : null;
  const hasStarted = completedCount > 0;

  const aggregatedMaterials = allLessons
    .filter((l) => !!l.external_resource_url)
    .slice(0, 6);

  return (
    <MemberLayout>
      <div className="p-6 md:p-10 bg-background">
        <div className="mb-6">
          <Link to="/mycourses" className="text-xs inline-flex items-center gap-1 text-foreground/60 hover:text-foreground">
            <ArrowLeft className="w-3 h-3" /> All courses
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div>
            {course.cover_image_path && (
              <div
                className="w-full aspect-[16/7] rounded-lg overflow-hidden mb-6 bg-muted"
                style={{
                  backgroundImage: `url(${course.cover_image_path})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                aria-hidden="true"
              />
            )}

            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-foreground/55 mb-2">Course</p>
              <h1 className="font-serif text-3xl md:text-4xl mb-2 text-foreground" style={{ fontWeight: 300 }}>
                {course.title}
              </h1>
              {course.subtitle && (
                <p className="text-sm text-foreground/70">{course.subtitle}</p>
              )}
              {course.status !== "published" && (
                <span className="inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                  {course.status}
                </span>
              )}
            </div>

            {course.description && (
              <p className="text-sm leading-relaxed text-foreground/75 mb-6 whitespace-pre-wrap">
                {course.description}
              </p>
            )}

            <div className="flex flex-wrap gap-6 text-xs text-foreground/65 mb-6">
              <span><strong className="text-foreground/85">{totalModules}</strong> module{totalModules === 1 ? "" : "s"}</span>
              <span><strong className="text-foreground/85">{totalLessons}</strong> lesson{totalLessons === 1 ? "" : "s"}</span>
              <span>
                {durationLabel
                  ? <><strong className="text-foreground/85">{durationLabel}</strong> total</>
                  : "Duration not available"}
              </span>
            </div>

            {!accessible && (
              <Card className="p-4 mb-6 border-amber-200 bg-amber-50/60 flex items-start gap-3">
                <Lock className="w-4 h-4 mt-0.5 text-amber-700" />
                <div className="text-sm text-amber-900">
                  This course requires a membership.{" "}
                  <Link to="/plans" className="underline">View plans</Link>.
                </div>
              </Card>
            )}

            {accessible && startHref && (
              <div className="mb-8">
                <Link to={startHref}>
                  <Button>{hasStarted ? "Continue Course" : "Start Course"}</Button>
                </Link>
                {hasStarted && resumeLesson && (
                  <p className="text-xs text-foreground/55 mt-2">
                    Last lesson: {resumeLesson.title}
                  </p>
                )}
              </div>
            )}

            {course.course_modules.length > 0 && (
              <section className="mb-8">
                <h2 className="font-serif text-xl mb-3 text-foreground">Modules overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {course.course_modules.map((m) => {
                    const moduleCompleted = m.lessons.filter((l) => completedIds.has(l.id)).length;
                    return (
                      <ModuleCard
                        key={m.id}
                        id={m.id}
                        title={m.title}
                        description={m.description}
                        lessonCount={m.lessons.length}
                        completedCount={moduleCompleted}
                        href={`/modules/${m.id}`}
                        badge={m.status !== "published" ? m.status : undefined}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mb-8">

              <h2 className="font-serif text-xl mb-3 text-foreground">Learning path</h2>
              <LearningPath
                modules={course.course_modules.map((m) => ({
                  id: m.id,
                  title: m.title,
                  description: m.description,
                  lessons: m.lessons.map((l) => ({
                    id: l.id,
                    title: l.title,
                    completed: completedIds.has(l.id),
                    locked: !accessible && !l.is_preview,
                  })),
                }))}
                activeLessonId={resumeLesson?.id ?? null}
                buildLessonHref={(moduleId, lessonId) => `/modules/${moduleId}#lesson-${lessonId}`}
              />
            </section>

            {aggregatedMaterials.length > 0 && (
              <section className="mb-8">
                <h2 className="font-serif text-xl mb-3 text-foreground">Materials</h2>
                <div className="flex flex-col gap-2">
                  {aggregatedMaterials.map((l) => (
                    <LessonMaterial key={l.id} url={l.external_resource_url} label={l.title} />
                  ))}
                </div>
              </section>
            )}

            {(courseQuizzesQuery.data ?? []).length > 0 && (
              <section className="mb-8 space-y-4">
                <h2 className="font-serif text-xl mb-3 text-foreground">Course quizzes</h2>
                {(courseQuizzesQuery.data ?? []).map((q) => (
                  <QuizCard key={q.id} quizId={q.id} />
                ))}
              </section>
            )}
          </div>



          <aside className="space-y-4">
            <Card className="p-4">
              <CourseProgress completed={completedCount} total={totalLessons} />
            </Card>

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
