import MemberLayout from "@/manus/components/MemberLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "@/manus/lib/trpc";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";


export default function ModuleDetail() {
  const params = useParams<{ id: string }>();
  const moduleId = params.id ? parseInt(params.id, 10) : 0;
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: module } = trpc.modules.get.useQuery({ id: moduleId }, { enabled: Number.isFinite(moduleId) && moduleId > 0 });
  const { data: lessons = [] } = trpc.lessons.byModule.useQuery({ moduleId }, { enabled: Number.isFinite(moduleId) && moduleId > 0 });
  const { data: progress = [] } = trpc.progress.moduleProgress.useQuery({ moduleId }, { enabled: Number.isFinite(moduleId) && moduleId > 0 });
  const markLessonMutation = trpc.progress.markLesson.useMutation({
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lessons.progress"] });
      await qc.invalidateQueries({ queryKey: ["progress.moduleProgress"] });
    },
  });


  const activeLesson = activeLessonId
    ? lessons.find((l) => l.id === activeLessonId)
    : lessons[0];

  const completedCount = progress.filter((p) => p.completed).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  const handleToggleLesson = async (lessonId: number, currentStatus: boolean) => {
    await markLessonMutation.mutateAsync({
      lessonId,
      moduleId,
      completed: !currentStatus,
    });
  };

  const isLessonCompleted = (lessonId: number) => {
    return progress.some((p) => p.lessonId === lessonId && p.completed);
  };

  const currentLessonIndex = activeLesson ? lessons.findIndex((l) => l.id === activeLesson.id) : 0;
  const previousLesson = currentLessonIndex > 0 ? lessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null;

  return (
    <MemberLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/50 bg-card/50 sticky top-0 z-40">
          <div className="container py-6">
            <Link to="/modules" className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition mb-4">
              <ChevronLeft className="w-4 h-4" />
              Back to Modules
            </Link>
            <h1 className="text-3xl font-bold mb-2">{module?.title}</h1>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-foreground/70">Progress</span>
                  <span className="text-sm font-semibold text-accent">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
              <span className="text-sm text-foreground/70">
                {completedCount} of {lessons.length} lessons
              </span>
            </div>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Lessons Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-4 sticky top-24">
                <h3 className="font-semibold mb-4">Lessons</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {lessons.map((lesson) => {
                    const isCompleted = isLessonCompleted(lesson.id);
                    const isActive = activeLesson?.id === lesson.id;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setActiveLessonId(lesson.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center gap-3 ${
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-card text-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs opacity-75">{lesson.number}</div>
                          <div className="text-sm font-medium truncate">{lesson.title}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {activeLesson ? (
                <div className="space-y-6">
                  {/* Lesson Header */}
                  <div className="border-b border-border/50 pb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm text-accent font-semibold uppercase tracking-widest mb-2">
                          {activeLesson.number}
                        </p>
                        <h2 className="text-3xl font-bold">{activeLesson.title}</h2>
                      </div>
                      <button
                        onClick={() =>
                          handleToggleLesson(activeLesson.id, isLessonCompleted(activeLesson.id))
                        }
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                          isLessonCompleted(activeLesson.id)
                            ? "bg-accent text-accent-foreground"
                            : "border border-accent text-accent hover:bg-accent/10"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isLessonCompleted(activeLesson.id) ? "Completed" : "Mark Complete"}
                      </button>
                    </div>
                  </div>

                  {/* Video (if available) */}
                  {activeLesson.videoUrl && (
                    <div className="bg-card rounded-lg overflow-hidden border border-border/50">
                      <div className="aspect-video bg-secondary/30 flex items-center justify-center">
                        <a
                          href={activeLesson.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:text-accent/80 transition"
                        >
                          <Button className="btn-gold">Watch Video</Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  {activeLesson.content && (
                    <Card className="p-8 prose prose-invert max-w-none">
                      <div className="whitespace-pre-wrap leading-relaxed">{activeLesson.content}</div>
                    </Card>
                  )}

                  {/* Navigation */}
                  <div className="flex items-center justify-between pt-8 border-t border-border/50">
                    {previousLesson ? (
                      <button
                        onClick={() => setActiveLessonId(previousLesson.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="text-sm text-foreground/70">
                      Lesson {currentLessonIndex + 1} of {lessons.length}
                    </div>

                    {nextLesson ? (
                      <button
                        onClick={() => setActiveLessonId(nextLesson.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
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
