import { useMemo, type CSSProperties } from "react";
import { resolveAssetUrl } from "@/manus/lib/asset-url";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Award, BookOpen, Clock3, Layers3, Lock } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import QueryStateView from "@/manus/components/QueryStateView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";
import { trpc } from "@/manus/lib/trpc";
import { canAccessCourse, pickResumeLessonId } from "@/manus/services/learning";
import { passedQuizIdsForCourse } from "@/manus/services/quiz";
import CourseProgress from "@/manus/components/learning/CourseProgress";
import LearningPath from "@/manus/components/learning/LearningPath";
import LessonMaterial from "@/manus/components/learning/LessonMaterial";
import { MemberPage, SectionHeader, StatusPill } from "@/manus/components/member/MemberUI";
import QuizCard from "@/manus/components/learning/QuizCard";
import SupportMaterialsList from "@/manus/components/learning/SupportMaterialsList";
import { HERO_FONT_CLASS, HERO_TITLE_CLASS, resolveHeroSettings } from "@/manus/lib/course-hero";

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
  thumbnail_path: string | null;
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
  hero_text_hidden: boolean | null;
  hero_title_color: string | null;
  hero_title_size: string | null;
  hero_title_font: string | null;
  hero_overlay_opacity: number | null;
  status: "draft" | "published" | "archived";
  access_plan_keys: string[] | null;
  course_modules: Module[];
};

async function fetchCourseTree(id: number): Promise<Course | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id,title,slug,subtitle,description,cover_image_path,banner_url," +
        "hero_text_hidden,hero_title_color,hero_title_size,hero_title_font,hero_overlay_opacity," +
        "status,access_plan_keys," +
        "course_modules(id,title,description,status,sort_order," +
        "lessons(id,module_id,title,description,content_text,external_video_url,external_resource_url,duration_seconds,is_preview,thumbnail_path,status,sort_order))",
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

  const { data: passedQuizIds } = useQuery({
    queryKey: ["course-passed-quizzes", courseId],
    enabled: Number.isFinite(courseId) && !authLoading && (isMember || isAdmin),
    queryFn: () => passedQuizIdsForCourse(courseId),
  });
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
  // Admins may paste either a full URL or a bare storage key; resolve both.
  const rawHeroImage = course.banner_url || course.cover_image_path;
  const heroImage = resolveAssetUrl(rawHeroImage);
  const hero = resolveHeroSettings(course);
  // The copy can only be hidden when there is actually an image carrying it.
  const heroTextHidden = hero.hidden && Boolean(heroImage);

  return (
    <MemberLayout>
      <MemberPage>
        <div className="mb-5">
          <Link to="/courses" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:text-accent">
            <ArrowLeft className="h-3.5 w-3.5" /> All courses
          </Link>
        </div>

        <section
          className={`aa-course-hero relative mb-8${heroImage ? " aa-course-hero--image" : ""}${heroTextHidden ? " aa-course-hero--plain" : ""}`}
          style={
            heroImage
              ? ({
                  // Consumed by `.aa-course-hero--image`, which needs !important to
                  // beat the palette gradient override in academy-design-system.css.
                  "--aa-hero-image": `url("${heroImage}")`,
                  "--aa-hero-scrim": hero.overlay,
                } as CSSProperties)
              : undefined
          }
        >
          {heroTextHidden ? (
            // The uploaded artwork already carries the title/description.
            <h1 className="sr-only">{course.title}</h1>
          ) : (
            <div className="aa-course-hero-content">
              {course.status !== "published" ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  <StatusPill tone="warning">{course.status}</StatusPill>
                </div>
              ) : null}
              <h1
                className={`aa-course-hero-title leading-none ${HERO_FONT_CLASS[hero.font]} ${HERO_TITLE_CLASS[hero.size]}${hero.color ? "" : " text-white"}`}
                style={hero.color ? { color: hero.color } : undefined}
              >
                {course.title}
              </h1>
              {course.subtitle ? (
                <p
                  className={`aa-course-hero-subtitle mt-4 max-w-2xl text-sm leading-7 sm:text-base${hero.color ? "" : " text-white"}`}
                  style={hero.color ? { color: hero.color } : undefined}
                >
                  {course.subtitle}
                </p>
              ) : null}
            </div>
          )}
          {isAdmin ? (
            <div className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] uppercase tracking-[0.14em] opacity-80">
              <StatusPill tone="accent">Student View</StatusPill>
            </div>
          ) : null}
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

            <section className="mb-10">
              <SectionHeader title="Learning path" description="Every module and lesson in sequence. Jump back to any lesson at any time." />
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
                      thumbnailPath: lesson.thumbnail_path,
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
              <section id="course-final-exam" className="mb-10 scroll-mt-24">
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
            {accessible && finalExam ? (
              <div className="aa-panel p-5">
                {passedFinalExam ? (
                  <>
                    <p className="flex items-center gap-2 text-sm leading-6 text-foreground/80">
                      <Award className="h-4 w-4 text-accent" /> You passed the final exam.
                    </p>
                    <Link to="/certificates" className="mt-4 block">
                      <Button variant="outline" className="w-full">View your certificate</Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm leading-6 text-foreground/80">
                      Take your quiz to generate your certificate of completion.
                    </p>
                    <a href="#course-final-exam" className="mt-4 block">
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                        Take your quiz
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </a>
                  </>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </MemberPage>
    </MemberLayout>
  );
}
