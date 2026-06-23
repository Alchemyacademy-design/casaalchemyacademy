import MemberLayout from "@/manus/components/MemberLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Share2, HelpCircle, MessageSquare, Menu } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { trpc } from "@/manus/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildLessonShareBody,
  parseLessonHash,
} from "@/manus/services/community-deeplink";
import { publishCrossTabInvalidation } from "@/manus/lib/cross-tab-query-sync";
import LessonPlayer from "@/manus/components/learning/LessonPlayer";
import LessonMaterial from "@/manus/components/learning/LessonMaterial";
import LessonSidebar from "@/manus/components/learning/LessonSidebar";
import CompletionButton from "@/manus/components/learning/CompletionButton";
import LessonNavigation from "@/manus/components/learning/LessonNavigation";
import CourseProgress from "@/manus/components/learning/CourseProgress";


export default function ModuleDetail() {
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const moduleId = params.id ? parseInt(params.id, 10) : 0;
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const qc = useQueryClient();

  const { data: module } = trpc.modules.get.useQuery({ id: moduleId }, { enabled: Number.isFinite(moduleId) && moduleId > 0 });
  const { data: lessons = [] } = trpc.lessons.byModule.useQuery({ moduleId }, { enabled: Number.isFinite(moduleId) && moduleId > 0 });
  const { data: progress = [] } = trpc.progress.moduleProgress.useQuery({ moduleId }, { enabled: Number.isFinite(moduleId) && moduleId > 0 });
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

  const appliedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!Number.isFinite(moduleId) || moduleId <= 0) return;
    if (!lessons.length) return;
    const hash = location.hash || "";
    const key = `${moduleId}:${hash}`;
    if (appliedKeyRef.current === key) return;
    const fromHash = parseLessonHash(hash, lessons);
    appliedKeyRef.current = key;
    setActiveLessonId(fromHash ?? lessons[0].id);
  }, [moduleId, lessons, location.hash]);

  const activeLesson = activeLessonId
    ? lessons.find((l) => l.id === activeLessonId)
    : lessons[0];

  const completedCount = progress.filter((p) => p.completed).length;
  const completedIds = useMemo(
    () => new Set(progress.filter((p) => p.completed).map((p) => p.lessonId)),
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

  const selectLesson = (id: number) => {
    setActiveLessonId(id);
    setMobileSidebar(false);
  };

  const sidebarLessons = lessons.map((l) => ({
    id: l.id,
    title: l.title,
    number: l.number ?? null,
  }));

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
              {activeLesson ? (
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

                  <LessonPlayer videoUrl={activeLesson.videoUrl} title={activeLesson.title} />

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
                    hasPrevious={!!previousLesson}
                    hasNext={!!nextLesson}
                    onPrevious={() => previousLesson && setActiveLessonId(previousLesson.id)}
                    onNext={() => nextLesson && setActiveLessonId(nextLesson.id)}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-foreground/70">No lessons available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}
