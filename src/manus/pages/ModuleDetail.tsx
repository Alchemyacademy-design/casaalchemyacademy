import MemberLayout from "@/manus/components/MemberLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Share2, HelpCircle, MessageSquare, Menu, AlertTriangle } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { trpc } from "@/manus/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildLessonShareBody,
  resolveLessonFromLocation,
} from "@/manus/services/community-deeplink";
import { publishCrossTabInvalidation } from "@/manus/lib/cross-tab-query-sync";
import LessonPlayer from "@/manus/components/learning/LessonPlayer";
import LessonNotes from "@/manus/components/lesson/LessonNotes";
import LessonMaterial from "@/manus/components/learning/LessonMaterial";
import LessonSidebar from "@/manus/components/learning/LessonSidebar";
import CompletionButton from "@/manus/components/learning/CompletionButton";
import LessonNavigation from "@/manus/components/learning/LessonNavigation";
import CourseProgress from "@/manus/components/learning/CourseProgress";
import QueryStateView from "@/manus/components/QueryStateView";
import QuizCard from "@/manus/components/learning/QuizCard";
import ModuleRating from "@/manus/components/learning/ModuleRating";
import LessonRating from "@/manus/components/lesson/LessonRating";
import LessonComments from "@/manus/components/lesson/LessonComments";
import StartDiscussionButton from "@/manus/components/lesson/StartDiscussionButton";



export default function ModuleDetail() {
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const moduleId = params.id ? parseInt(params.id, 10) : 0;
  const isValidModuleId = Number.isFinite(moduleId) && moduleId > 0;
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const qc = useQueryClient();

  const moduleQuery = trpc.modules.get.useQuery({ id: moduleId }, { enabled: isValidModuleId });
  const lessonsQuery = trpc.lessons.byModule.useQuery({ moduleId }, { enabled: isValidModuleId });
  const progressQuery = trpc.progress.moduleProgress.useQuery({ moduleId }, { enabled: isValidModuleId });

  const module = moduleQuery.data as { title?: string; course_id?: number | null } | undefined;
  const lessons = useMemo(
    () =>
      (lessonsQuery.data ?? []) as Array<{
        id: number;
        title: string;
        number?: number | null;
        videoUrl?: string | null;
        content?: string | null;
        external_resource_url?: string | null;
      }>,
    [lessonsQuery.data],
  );
  const progress = useMemo(
    () => (progressQuery.data ?? []) as Array<{ lessonId: number; completed: boolean }>,
    [progressQuery.data],
  );
  const progressError = progressQuery.error;


  const markLessonMutation = trpc.progress.markLesson.useMutation({
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lessons.progress"] });
      await qc.invalidateQueries({ queryKey: ["progress.moduleProgress"] });
      publishCrossTabInvalidation("lesson_progress.updated", [
        ["lessons.progress"],
        ["progress.moduleProgress"],
        ["modules-page", "courses"],
      ]);
    },
  });


  const courseId: number | null =
    (module as { course_id?: number | null } | undefined)?.course_id ?? null;
  const { data: courseRow } = useQuery({
    queryKey: ["course-title", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,title")
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const CTA_CHANNEL_SLUGS = ["projects", "questions", "general"] as const;
  type CtaSlug = (typeof CTA_CHANNEL_SLUGS)[number];
  const { data: ctaChannels } = useQuery({
    queryKey: ["community-cta-channels", CTA_CHANNEL_SLUGS.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_channels")
        .select("slug, community_spaces!inner(slug)")
        .in("slug", CTA_CHANNEL_SLUGS as unknown as string[]);
      if (error) throw error;
      const map: Record<string, { spaceSlug: string }> = {};
      for (const row of (data ?? []) as Array<{
        slug: string;
        community_spaces: { slug: string } | { slug: string }[] | null;
      }>) {
        const sp = Array.isArray(row.community_spaces)
          ? row.community_spaces[0]
          : row.community_spaces;
        if (sp?.slug && !map[row.slug]) map[row.slug] = { spaceSlug: sp.slug };
      }
      return map;
    },
  });

  // Lesson-level published quizzes for this module.
  const lessonQuizQuery = useQuery({
    queryKey: ["lesson-quiz", "module", moduleId, "published", (lessons ?? []).map((l) => l.id).join(",")],
    enabled: isValidModuleId && (lessons?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = (lessons ?? []).map((l) => l.id);
      if (!ids.length) return [] as Array<{ id: number; lesson_id: number | null; status: string }>;
      let query = supabase
        .from("quizzes")
        .select("id,lesson_id,status")
        .in("lesson_id", ids);
      query = query.eq("status", "published");
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as Array<{ id: number; lesson_id: number | null; status: string }>);
    },
  });

  // Module-level exam (module_id = current module, published).
  const moduleExamQuery = useQuery({
    queryKey: ["module-exam", moduleId, "published"],
    enabled: isValidModuleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title")
        .eq("module_id", moduleId)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as { id: number; title: string } | null;
    },
  });

  // Course-level quizzes are intentionally not rendered inside the lesson
  // player. Admins use this notice to attach each quiz to the correct lesson.
  // Fetch sibling modules (same course) so Next/Previous can cross module
  // boundaries when the user reaches the edge of the current module.
  const currentCourseId: number | null =
    (module as { course_id?: number | null } | undefined)?.course_id ?? null;
  const siblingModulesQuery = useQuery({
    queryKey: ["module-siblings", currentCourseId, "published"],
    enabled: !!currentCourseId,
    queryFn: async () => {
      let query = supabase
        .from("course_modules")
        .select("id,sort_order,status")
        .eq("course_id", currentCourseId!)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      query = query.eq("status", "published");
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as Array<{ id: number; sort_order: number; status: string }>);
    },
  });

  const siblingModules = siblingModulesQuery.data ?? [];
  const currentModuleIndex = siblingModules.findIndex((m) => m.id === moduleId);
  const previousModule =
    currentModuleIndex > 0 ? siblingModules[currentModuleIndex - 1] : null;
  const nextModule =
    currentModuleIndex >= 0 && currentModuleIndex < siblingModules.length - 1
      ? siblingModules[currentModuleIndex + 1]
      : null;

  const appliedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!Number.isFinite(moduleId) || moduleId <= 0) return;
    if (!lessons.length) return;
    // Include search + hash in the key so back/forward, refresh, and
    // ?lesson=<id> deep links all resync the active lesson.
    const key = `${moduleId}:${location.search}:${location.hash}`;
    if (appliedKeyRef.current === key) return;
    const resolved = resolveLessonFromLocation(location.search, location.hash, lessons);
    appliedKeyRef.current = key;
    setActiveLessonId(resolved ?? lessons[0].id);
  }, [moduleId, lessons, location.search, location.hash]);

  const activeLesson = activeLessonId
    ? lessons.find((l) => l.id === activeLessonId)
    : lessons[0];

  const completedCount = progress.filter((p) => p.completed).length;
  const completedIds = useMemo(
    () => new Set<number>(progress.filter((p) => p.completed).map((p) => Number(p.lessonId))),
    [progress],
  );

  const handleToggleLesson = async (lessonId: number, currentStatus: boolean) => {
    await markLessonMutation.mutateAsync({
      lessonId,
      moduleId,
      completed: !currentStatus,
    });
  };

  const isLessonCompleted = (lessonId: number) => completedIds.has(lessonId);

  const currentLessonIndex = activeLesson ? lessons.findIndex((l) => l.id === activeLesson.id) : 0;
  const previousLesson = currentLessonIndex > 0 ? lessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null;
  const hasPrevious = !!previousLesson || !!previousModule;
  const hasNext = !!nextLesson || !!nextModule;

  const selectLesson = (id: number) => {
    setActiveLessonId(id);
    setMobileSidebar(false);
    // Persist the active lesson in BOTH the query string (survives refresh /
    // share) and the hash (legacy deep links). Use navigate() so React Router
    // pushes a real history entry and browser back/forward step through
    // lessons in order.
    const sp = new URLSearchParams(location.search);
    sp.set("lesson", String(id));
    const nextSearch = `?${sp.toString()}`;
    const nextHash = `#lesson-${id}`;
    if (location.search !== nextSearch || location.hash !== nextHash) {
      navigate(`${location.pathname}${nextSearch}${nextHash}`);
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPrevious = () => {
    if (previousLesson) {
      selectLesson(previousLesson.id);
      return;
    }
    if (previousModule) {
      // Jump to the previous module; the effect above resolves the first
      // lesson when no ?lesson=<id> is present.
      navigate(`/modules/${previousModule.id}`);
    }
  };

  const goToNext = () => {
    if (nextLesson) {
      selectLesson(nextLesson.id);
      return;
    }
    if (nextModule) {
      navigate(`/modules/${nextModule.id}`);
    }
  };


  const activeLessonQuiz = activeLesson
    ? (lessonQuizQuery.data ?? []).find((q) => q.lesson_id === activeLesson.id)
    : null;
  const isLastLesson = activeLesson ? lessons[lessons.length - 1]?.id === activeLesson.id : false;
  const moduleExam = moduleExamQuery.data;

  const lessonQuizIds = new Set((lessonQuizQuery.data ?? []).map((q) => Number(q.lesson_id)).filter(Boolean));
  const sidebarLessons = lessons.map((l) => ({
    id: l.id,
    title: l.title,
    number: l.number ?? null,
    hasQuiz: lessonQuizIds.has(l.id),
  }));

  if (!isValidModuleId) {
    return (
      <MemberLayout>
        <div className="p-10 text-sm text-foreground/70">Invalid module id.</div>
      </MemberLayout>
    );
  }

  const moduleLoading = moduleQuery.isLoading;
  const moduleError = moduleQuery.error;
  const moduleMissing = !moduleLoading && !moduleError && !module;
  const lessonsLoading = lessonsQuery.isLoading;
  const lessonsError = lessonsQuery.error;
  // Defence-in-depth: do not render lessons or progress UI until the parent
  // module is confirmed loaded and accessible.
  const moduleReady = !!module && !moduleError;

  if (moduleLoading || moduleError || moduleMissing) {
    return (
      <MemberLayout>
        <div className="p-6 md:p-10">
          <Link to="/mycourses" className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition mb-4 text-sm">
            <ChevronLeft className="w-4 h-4" /> Back to Courses
          </Link>
          <QueryStateView
            isLoading={moduleLoading}
            isFetching={moduleQuery.isFetching}
            error={moduleError}
            empty={moduleMissing}
            onRetry={() => moduleQuery.refetch?.()}
            errorTitle="Failed to load module"
            emptyMessage="Module unavailable or you do not have access."
          >
            <></>
          </QueryStateView>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/50 bg-card/50 sticky top-0 z-40">
          <div className="container py-6">
            <Link to="/mycourses" className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition mb-4">
              <ChevronLeft className="w-4 h-4" />
              Back to Courses
            </Link>
            <h1 className="text-3xl font-bold mb-2">{module?.title}</h1>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 max-w-xs min-w-[200px]">
                <CourseProgress completed={completedCount} total={lessons.length} />
              </div>
              <button
                type="button"
                className="lg:hidden inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 text-sm"
                onClick={() => setMobileSidebar((v) => !v)}
                aria-expanded={mobileSidebar}
                aria-controls="mobile-lesson-sidebar"
                aria-label="Toggle lessons sidebar"
              >
                <Menu className="w-4 h-4" /> Lessons
              </button>
            </div>
            {progressError && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400" role="status">
                <AlertTriangle className="w-3.5 h-3.5" /> Progress unavailable — your completion state may be out of date.
              </p>
            )}
          </div>
        </div>



        <div className="container py-8">
          <div className="grid lg:grid-cols-4 gap-8">
            <aside className="hidden lg:block lg:col-span-1">
              <Card className="p-4 sticky top-32">
                <LessonSidebar
                  lessons={sidebarLessons}
                  activeLessonId={activeLesson?.id ?? null}
                  completedLessonIds={completedIds}
                  onSelect={selectLesson}
                />
              </Card>
            </aside>

            {mobileSidebar && (
              <div id="mobile-lesson-sidebar" className="lg:hidden col-span-full">
                <Card className="p-4">
                  <LessonSidebar
                    lessons={sidebarLessons}
                    activeLessonId={activeLesson?.id ?? null}
                    completedLessonIds={completedIds}
                    onSelect={selectLesson}
                  />
                </Card>
              </div>
            )}

            <div className="lg:col-span-3">
              <QueryStateView
                isLoading={lessonsLoading}
                isFetching={lessonsQuery.isFetching}
                error={lessonsError}
                empty={!lessonsLoading && !lessonsError && lessons.length === 0}
                onRetry={() => lessonsQuery.refetch?.()}
                errorTitle="Failed to load lessons"
                emptyMessage="No lessons available yet."
              >
              {moduleReady && activeLesson ? (

                <div className="space-y-6">
                  <div className="border-b border-border/50 pb-6">
                    <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                      <div>
                        {activeLesson.number != null && (
                          <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-2">
                            Lesson {activeLesson.number}
                          </p>
                        )}
                        <h2 className="text-3xl font-bold">{activeLesson.title}</h2>
                      </div>
                      <CompletionButton
                        completed={isLessonCompleted(activeLesson.id)}
                        onToggle={() =>
                          handleToggleLesson(activeLesson.id, isLessonCompleted(activeLesson.id))
                        }
                      />
                    </div>
                  </div>

                  <LessonPlayer videoUrl={activeLesson.videoUrl} title={activeLesson.title} isAdmin={false} />

                  <LessonNotes lessonId={Number(activeLesson.id)} />

                  {activeLessonQuiz ? (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-foreground/60 mb-2">Lesson quiz</p>
                      <QuizCard quizId={activeLessonQuiz.id} previewAsAdmin={false} />
                    </div>
                  ) : null}

                  {isLastLesson && moduleExam ? (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-accent mb-2">Module exam</p>
                      <QuizCard quizId={moduleExam.id} previewAsAdmin={false} />
                    </div>
                  ) : null}

                  {activeLesson.content && (
                    <Card className="p-8 prose prose-invert max-w-none">
                      <div className="whitespace-pre-wrap leading-relaxed">{activeLesson.content}</div>
                    </Card>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-wider text-foreground/60 mb-2">Material</p>
                    <LessonMaterial
                      url={(activeLesson as { external_resource_url?: string | null }).external_resource_url ?? null}
                    />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-foreground/60 mb-2">Your feedback</p>
                    <ModuleRating moduleId={moduleId} />
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-wider text-foreground/60">
                      Lesson feedback
                    </p>
                    <LessonRating lessonId={activeLesson.id} courseId={currentCourseId} />
                    <LessonComments lessonId={activeLesson.id} courseId={currentCourseId} />
                    <div>
                      <StartDiscussionButton
                        lessonId={activeLesson.id}
                        lessonTitle={activeLesson.title}
                        courseId={currentCourseId}
                      />
                    </div>
                  </div>





                  {(() => {
                    const lessonUrl = `/modules/${moduleId}#lesson-${activeLesson.id}`;
                    const courseTitle =
                      (courseRow as { title?: string } | null | undefined)?.title ??
                      "this course";
                    const moduleTitle = module?.title ?? "this module";
                    const lessonTitle = activeLesson.title;
                    const buildLink = (
                      channel: CtaSlug,
                      title: string,
                      intro: string,
                    ) => {
                      const body = buildLessonShareBody({
                        courseTitle,
                        moduleTitle,
                        lessonTitle,
                        lessonUrl,
                        intro,
                      });
                      const spaceSlug = ctaChannels?.[channel]?.spaceSlug;
                      const params = new URLSearchParams();
                      if (spaceSlug) params.set("space", spaceSlug);
                      params.set("channel", channel);
                      params.set("title", title);
                      params.set("body", body);
                      return `/community?${params.toString()}`;
                    };
                    return (
                      <Card className="p-4 flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-foreground/70 mr-2">
                          Bring this lesson to the community:
                        </span>
                        <Link
                          to={buildLink(
                            "projects",
                            `My progress on "${lessonTitle}"`,
                            `I just finished "${lessonTitle}".`,
                          )}
                        >
                          <Button variant="outline" size="sm">
                            <Share2 className="w-4 h-4 mr-2" /> Share your progress
                          </Button>
                        </Link>
                        <Link
                          to={buildLink(
                            "questions",
                            `Question about "${lessonTitle}"`,
                            `I have a question about this lesson:`,
                          )}
                        >
                          <Button variant="outline" size="sm">
                            <HelpCircle className="w-4 h-4 mr-2" /> Ask the community
                          </Button>
                        </Link>
                        <Link
                          to={buildLink(
                            "general",
                            `Discussing "${lessonTitle}"`,
                            `Let's discuss this lesson:`,
                          )}
                        >
                          <Button variant="outline" size="sm">
                            <MessageSquare className="w-4 h-4 mr-2" /> Discuss this lesson
                          </Button>
                        </Link>
                      </Card>
                    );
                  })()}

                  <LessonNavigation
                    currentIndex={currentLessonIndex}
                    total={lessons.length}
                    hasPrevious={hasPrevious}
                    hasNext={hasNext}
                    onPrevious={goToPrevious}
                    onNext={goToNext}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-foreground/70">No lesson selected.</p>
                </div>
              )}
              </QueryStateView>
            </div>

          </div>
        </div>
      </div>
    </MemberLayout>
  );
}
