import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, Layers3, Lock } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import QueryStateView from "@/manus/components/QueryStateView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";
import { trpc } from "@/manus/lib/trpc";
import { canAccessCourse, pickResumeLessonId } from "@/manus/services/learning";
import CourseProgress from "@/manus/components/learning/CourseProgress";
import LearningPath from "@/manus/components/learning/LearningPath";
import LessonMaterial from "@/manus/components/learning/LessonMaterial";
import ModuleCard from "@/manus/components/learning/ModuleCard";
import { MemberPage, SectionHeader, StatusPill } from "@/manus/components/member/MemberUI";
import QuizCard from "@/manus/components/learning/QuizCard";
import SupportMaterialsList from "@/manus/components/learning/SupportMaterialsList";

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
  banner_url: string | null;
  status: "draft" | "published" | "archived";
  access_plan_keys: string[] | null;
  course_modules: Module[];
};

async function fetchCourseTree(id: number): Promise<Course | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id,title,slug,subtitle,description,cover_image_path,banner_url,status,access_plan_keys," +
        "course_modules(id,title,description,status,sort_order," +
        "lessons(id,module_id,title,description,content_text,external_video_url,external_resource_url,duration_seconds,is_preview,status,sort_order))",
    )
    .eq("id", id)
    .eq("status", "published")
    .order("sort_order", { foreignTable: "course_modules", ascending: true })
    .order("sort_order", { foreignTable: "course_modules.lessons", ascending: true })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const course = data as unknown as Course;
  course.course_modules = course.course_modules
    .filter((module) => module.status === "published")
    .map((module) => ({ ...module, lessons: module.lessons.filter((lesson) => lesson.status === "published") }));
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
  const { loading: authLoading, isAdmin, isMember, hasCourseAccess, activeEntitlements } = useAuth();

  const { data: course, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["public", "course", courseId, "published"],
    queryFn: () => fetchCourseTree(courseId),
    enabled: Number.isFinite(courseId),
    staleTime: 2 * 60 * 1000,
  });

  const accessState = {
    isAdmin,
    isMember,
    hasCourseAccess,
    entitlementCourseIds: (activeEntitlements ?? []).map((item) => Number(item.course_id)).filter(Boolean),
  };
  const accessible = !course || canAccessCourse(course.id, course.access_plan_keys, accessState);

  const allLessons = useMemo<Lesson[]>(
    () => (course?.course_modules ?? []).flatMap((module) => module.lessons),
    [course],
  );

  const { data: progress = [] } = trpc.lessons.progress.useQuery();

  const { data: finalExam } = useQuery({
    queryKey: ["course-final-exam", courseId, "published"],
    enabled: Number.isFinite(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title")
        .eq("course_id", courseId)
        .is("lesson_id", null)
        .is("module_id", null)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as { id: number; title: string } | null;
    },
  });
  const completedIds = useMemo(
    () =>
      new Set<number>(
        progress
          .filter((item: { completed: boolean; lessonId: number }) => item.completed)
          .map((item) => Number(item.lessonId)),
      ),
    [progress],
  );

  if (!Number.isFinite(courseId)) {
    return (
      <MemberLayout>
        <MemberPage>
          <div className="aa-empty-state">Invalid course id.</div>
        </MemberPage>
      </MemberLayout>
    );
  }

  if (error) {
    return (
      <MemberLayout>
        <MemberPage>
          <QueryStateView
            isLoading={false}
            isFetching={isFetching}
            error={error}
            onRetry={() => refetch()}
            errorTitle="Failed to load course"
          >
            <></>
          </QueryStateView>
        </MemberPage>
      </MemberLayout>
    );
  }

  if (isLoading || authLoading) {
    return (
      <MemberLayout>
        <MemberPage>
          <div className="aa-empty-state" role="status" aria-busy="true">
            Loading course…
          </div>
        </MemberPage>
      </MemberLayout>
    );
  }

  if (!course) {
    return (
      <MemberLayout>
        <MemberPage>
          <div className="aa-empty-state">
            <h1 className="font-serif text-3xl text-primary">Course unavailable</h1>
            <p className="mt-2 text-sm">This course may not be published or your account may not have access.</p>
            <Link to="/mycourses" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to courses
            </Link>
          </div>
        </MemberPage>
      </MemberLayout>
    );
  }

  const totalModules = course.course_modules.length;
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const totalDurationSeconds = allLessons.reduce((sum, lesson) => sum + (lesson.duration_seconds ?? 0), 0);
  const durationLabel = formatDuration(totalDurationSeconds);
  const resumeLessonId = pickResumeLessonId(
    allLessons,
    progress as Array<{ lessonId: number; completed: boolean; last_watched_at?: string | null }>,
  );
  const resumeLesson = allLessons.find((lesson) => lesson.id === resumeLessonId) ?? allLessons[0] ?? null;
  const startHref = accessible && resumeLesson ? `/modules/${resumeLesson.module_id}?lesson=${resumeLesson.id}#lesson-${resumeLesson.id}` : null;
  const hasStarted = completedCount > 0;
  const visibleLessons = accessible ? allLessons : allLessons.filter((lesson) => lesson.is_preview === true);
  const aggregatedMaterials = visibleLessons.filter((lesson) => Boolean(lesson.external_resource_url)).slice(0, 6);

  return (
    <MemberLayout>
      <MemberPage>
        <div className="mb-5">
          <Link to="/courses" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:text-accent">
            <ArrowLeft className="h-3.5 w-3.5" /> All courses
          </Link>
        </div>

        <section
          className={`aa-course-hero mb-8${heroImage ? " aa-course-hero--image" : ""}`}
          style={
            heroImage
              ? {
                  backgroundImage: `url(${heroImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }
              : undefined
          }
        >
          <div className="aa-course-hero-content">
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusPill tone="accent">Course</StatusPill>
              {course.status !== "published" ? <StatusPill tone="warning">{course.status}</StatusPill> : null}
              {isAdmin ? <StatusPill tone="accent">Student View</StatusPill> : null}
            </div>
            <h1 className="font-serif text-4xl leading-none text-white sm:text-5xl lg:text-6xl">{course.title}</h1>
            {course.subtitle ? <p className="mt-4 max-w-2xl text-sm leading-7 text-white/82 sm:text-base">{course.subtitle}</p> : null}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="aa-course-meta mb-8">
              <span className="aa-meta-pill"><Layers3 className="h-3.5 w-3.5 text-accent" /> {totalModules} module{totalModules === 1 ? "" : "s"}</span>
              <span className="aa-meta-pill"><BookOpen className="h-3.5 w-3.5 text-accent" /> {totalLessons} lesson{totalLessons === 1 ? "" : "s"}</span>
              <span className="aa-meta-pill"><Clock3 className="h-3.5 w-3.5 text-accent" /> {durationLabel || "Duration pending"}</span>
            </div>

            {course.description ? (
              <section className="aa-panel mb-8 p-5 sm:p-7">
                <p className="aa-eyebrow">About this course</p>
                <div className="whitespace-pre-wrap text-sm leading-8 text-foreground/75">{course.description}</div>
              </section>
            ) : null}

            {!accessible ? (
              <Card className="mb-8 flex items-start gap-3 border-amber-300/70 bg-amber-50/70 p-5 text-amber-950">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-sm leading-6">
                  This course requires membership access. <Link to="/plans" className="font-semibold underline">View plans</Link>.
                </div>
              </Card>
            ) : null}

            {accessible && course.course_modules.length > 0 ? (
              <section className="mb-10">
                <SectionHeader title="Modules overview" description="A clear view of the complete course before you begin." />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {course.course_modules.map((module) => {
                    const moduleCompleted = module.lessons.filter((lesson) => completedIds.has(lesson.id)).length;
                    return (
                      <ModuleCard
                        key={module.id}
                        id={module.id}
                        title={module.title}
                        description={module.description}
                        lessonCount={module.lessons.length}
                        completedCount={moduleCompleted}
                        href={`/modules/${module.id}`}
                        badge={module.status !== "published" ? module.status : undefined}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="mb-10">
              <SectionHeader title="Learning path" description="Follow the course in sequence or return directly to a previous lesson." />
              <div className="aa-panel overflow-hidden p-3 sm:p-5">
                <LearningPath
                  modules={course.course_modules.map((module) => ({
                    id: module.id,
                    title: module.title,
                    description: module.description,
                    lessons: module.lessons.map((lesson) => ({
                      id: lesson.id,
                      title: lesson.title,
                      completed: completedIds.has(lesson.id),
                      locked: !accessible && !lesson.is_preview,
                    })),
                  }))}
                  activeLessonId={resumeLesson?.id ?? null}
                  buildLessonHref={(moduleId, lessonId) => `/modules/${moduleId}?lesson=${lessonId}#lesson-${lessonId}`}
                />
              </div>
            </section>

            <section className="mb-10">
              <SectionHeader title="Materials" description="Resources collected from across the course." />
              <div className="aa-panel flex flex-col gap-4 p-4">
                {accessible ? (
                  <>
                    <SupportMaterialsList scope={{ courseId }} title="Course support materials" emptyHidden={false} />
                    {visibleLessons.map((lesson) => (
                      <SupportMaterialsList
                        key={lesson.id}
                        scope={{ lessonId: lesson.id }}
                        title={lesson.title}
                      />
                    ))}
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" /> Support materials unlock when you join this course.
                  </p>
                )}
                {aggregatedMaterials.map((lesson) => (
                  <LessonMaterial key={`legacy-${lesson.id}`} url={lesson.external_resource_url} label={lesson.title} />
                ))}
              </div>
            </section>

            {accessible && finalExam ? (
              <section className="mb-10">
                <SectionHeader title="Course final exam" description="Pass this exam to complete the course." />
                <QuizCard quizId={finalExam.id} previewAsAdmin={false} />
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="aa-panel aa-sticky-panel overflow-hidden">
              <div className="border-b border-border bg-secondary/35 p-5">
                <p className="aa-eyebrow">Your progress</p>
                <CourseProgress completed={completedCount} total={totalLessons} />
              </div>
              <div className="p-5">
                {accessible && startHref ? (
                  <Link to={startHref} className="block">
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      {hasStarted ? "Continue Course" : "Start Course"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/plans" className="block">
                    <Button variant="outline" className="w-full">View membership</Button>
                  </Link>
                )}
                {hasStarted && resumeLesson ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Resume from: {resumeLesson.title}</p> : null}
              </div>
            </div>
          </aside>
        </div>
      </MemberPage>
    </MemberLayout>
  );
}
