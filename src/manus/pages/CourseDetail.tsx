import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/manus/hooks/useAuth";
import { trpc } from "@/manus/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { LessonRow, ModuleRow, ProgressRow } from "@/manus/lib/types";
import VideoPreview from "@/manus/components/admin/VideoPreview";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const moduleId = parseInt(id || "1");

  // Fetch module and lessons data
  const { data: module } = trpc.modules.byId.useQuery({ id: moduleId });
  const { data: lessons = [] } = trpc.lessons.byModule.useQuery({ moduleId });
  const { data: progress = [] } = trpc.lessons.progress.useQuery({ lessonId: 0 });
  const { data: allModules = [] } = trpc.modules.list.useQuery();

  const markLessonMutation = trpc.lessons.markComplete.useMutation({
    onSuccess: () => {
      trpc.useUtils().lessons.progress.invalidate();
    },
  });

  const currentLesson = lessons[0];
  const isLessonCompleted = (lessonId: number) => {
    return progress.some((p: ProgressRow) => p.lessonId === lessonId && p.completed);
  };

  const handleMarkComplete = async () => {
    if (currentLesson) {
      try {
        await markLessonMutation.mutateAsync({ lessonId: currentLesson.id });
      } catch (error) {
        console.error("Error marking lesson complete:", error);
      }
    }
  };

  if (!module || !currentLesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground">Loading...</p>
      </div>
    );
  }

  const completedCount = progress.filter((p: ProgressRow) => p.completed).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const currentModuleNumber = allModules.findIndex((m: ModuleRow) => m.id === moduleId) + 1;
  const totalModules = allModules.length;

  // Course title and module data
  const courseTitle = "The Path to a Colourful Life";
  const moduleTitle = module.title || "Module Title";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 sticky top-0 z-40">
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-1">{courseTitle}</h1>
          <p className="text-sm text-foreground/70">Module {currentModuleNumber} of {totalModules}</p>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Module Title */}
            <h2 className="text-4xl font-bold mb-8 text-center" style={{ color: "var(--aa-olive-dark)" }}>
              {moduleTitle}
            </h2>

            {/* Video Player */}
            <div className="mb-8 rounded-lg overflow-hidden">
              <VideoPreview url={currentLesson.videoUrl} />
            </div>


            {/* About this module */}
            <Card className="p-6 mb-8 bg-card border-border/50">
              <h3 className="text-xl font-bold mb-4" style={{ color: "var(--aa-olive-dark)" }}>
                About this module
              </h3>
              <p className="text-foreground/80 leading-relaxed">
                {module.description || "Discover the trending color palettes that will dominate interior design in 2026. Learn how to incorporate these colors into your spaces for a modern, sophisticated look."}
              </p>
            </Card>

            {/* Lessons in this module */}
            <Card className="p-6 mb-8 bg-card border-border/50">
              <h3 className="text-xl font-bold mb-4" style={{ color: "var(--aa-olive-dark)" }}>
                Lessons in this module
              </h3>
              <div className="space-y-3">
                {lessons.map((lesson: LessonRow, idx: number) => {
                  const isCompleted = isLessonCompleted(lesson.id);
                  return (
                    <div key={lesson.id} className="flex items-center gap-3 text-foreground/80">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-foreground/30 flex-shrink-0" />
                      )}
                      <span>{lesson.title}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Quiz Section */}
            <Card className="p-6 mb-8 bg-card border-border/50">
              <h3 className="text-xl font-bold mb-6" style={{ color: "var(--aa-olive-dark)" }}>
                Quiz: Question 1 of 5
              </h3>
              <p className="mb-6 text-foreground font-semibold">Which of these is a trending color for 2026?</p>
              <div className="space-y-3 mb-8">
                {[
                  { letter: "A", text: "Neon Pink" },
                  { letter: "B", text: "Warm Terracotta" },
                  { letter: "C", text: "Bright Yellow" },
                  { letter: "D", text: "Electric Blue" },
                ].map((option) => (
                  <button
                    key={option.letter}
                    className="w-full text-left p-4 border border-border/50 rounded-lg hover:bg-card/50 transition"
                  >
                    <span className="font-semibold">{option.letter})</span> {option.text}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button className="text-accent hover:text-accent/80 transition">← Previous</button>
                <span className="text-foreground/70">1 / 5</span>
                <button className="text-accent hover:text-accent/80 transition">Next →</button>
              </div>
            </Card>

            {/* Rating Section */}
            <Card className="p-6 bg-card border-border/50">
              <h3 className="text-xl font-bold mb-6" style={{ color: "var(--aa-olive-dark)" }}>
                Rate this module
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="transition"
                    >
                      <Star
                        size={32}
                        className={hoverRating >= star || rating >= star ? "fill-accent text-accent" : "text-foreground/30"}
                      />
                    </button>
                  ))}
                </div>
                <div>
                  <p className="font-semibold text-foreground">Your rating: {rating} ★</p>
                  <p className="text-sm text-foreground/70">5.0 ★ (1 rating)</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar - Modules List */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24 bg-card border-border/50">
              <h3 className="text-lg font-bold mb-6" style={{ color: "var(--aa-olive-dark)" }}>
                Modules
              </h3>
              <div className="space-y-3">
                {allModules.map((m: ModuleRow, idx: number) => (
                  <Link key={m.id} to={`/courses/${m.id}`}>
                    <button
                      className={`w-full text-left p-3 rounded-lg transition ${
                        m.id === moduleId
                          ? "bg-accent/20 border-l-4 border-accent"
                          : "hover:bg-card border-l-4 border-transparent"
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground">Module {idx + 1}</p>
                      <p className="text-xs text-foreground/70 truncate">{m.title}</p>
                    </button>
                  </Link>
                ))}
                <div className="pt-3 border-t border-border/50">
                  <button className="w-full text-left p-3 rounded-lg hover:bg-card transition">
                    <p className="text-sm font-semibold text-foreground">Final Note</p>
                    <p className="text-xs text-foreground/70">Course Completion & Certificate</p>
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
