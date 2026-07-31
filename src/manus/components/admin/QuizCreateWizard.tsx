/**
 * Quiz creation wizard (admin-only).
 *
 * Replaces the old "fill a long form first, discover AI/import later" flow.
 * The admin picks HOW they want to build the quiz first (AI / import / manual),
 * then only answers the few questions that actually matter (where it lives and
 * what it is called). The quiz is always created as a DRAFT and the editor
 * opens straight into the chosen tool.
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, FileUp, PencilLine, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export type QuizBuildMethod = "ai" | "import" | "manual";

export type WizardCourse = { id: number; title: string };
export type WizardModule = { id: number; title: string; course_id: number };
export type WizardLesson = { id: number; title: string; module_id: number };

type Scope = "lesson" | "module" | "course";

const METHODS: Array<{
  key: QuizBuildMethod;
  title: string;
  blurb: string;
  icon: typeof Sparkles;
}> = [
  {
    key: "ai",
    title: "Create with AI",
    blurb: "Generate questions from the real lesson / module content.",
    icon: Sparkles,
  },
  {
    key: "import",
    title: "Import a ready quiz",
    blurb: "Upload a PDF / text file or paste a quiz you already wrote.",
    icon: FileUp,
  },
  {
    key: "manual",
    title: "Build manually",
    blurb: "Write each question and mark the correct answer yourself.",
    icon: PencilLine,
  },
];

export default function QuizCreateWizard({
  courses,
  modules,
  lessons,
  fixedCourseId,
  onCreated,
  onCancel,
}: {
  courses: WizardCourse[];
  modules: WizardModule[];
  lessons: WizardLesson[];
  fixedCourseId?: number;
  onCreated: (info: { quizId: number; courseId: number; method: QuizBuildMethod }) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<QuizBuildMethod | null>(null);
  const [courseId, setCourseId] = useState<number | null>(fixedCourseId ?? null);
  const [scope, setScope] = useState<Scope>("lesson");
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [title, setTitle] = useState("");

  const courseModules = useMemo(
    () => modules.filter((m) => m.course_id === courseId),
    [modules, courseId],
  );
  const courseLessons = useMemo(() => {
    const ids = new Set(courseModules.map((m) => m.id));
    return lessons.filter((l) => ids.has(l.module_id));
  }, [lessons, courseModules]);

  const create = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("Choose a course first.");
      if (scope === "lesson" && !lessonId) throw new Error("Choose the lesson this quiz belongs to.");
      if (scope === "module" && !moduleId) throw new Error("Choose the module this exam belongs to.");
      const fallbackTitle =
        scope === "lesson"
          ? courseLessons.find((l) => l.id === lessonId)?.title
            ? `Knowledge check — ${courseLessons.find((l) => l.id === lessonId)!.title}`
            : "Knowledge check"
          : scope === "module"
          ? `Module exam — ${courseModules.find((m) => m.id === moduleId)?.title ?? ""}`.trim()
          : `Final exam — ${courses.find((c) => c.id === courseId)?.title ?? ""}`.trim();
      const { data, error } = await db
        .from("quizzes")
        .insert({
          course_id: courseId,
          lesson_id: scope === "lesson" ? lessonId : null,
          module_id: scope === "module" ? moduleId : null,
          title: title.trim() || fallbackTitle,
          passing_score: 70,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as number;
    },
    onSuccess: (quizId) => {
      toast.success("Draft quiz created — hidden from students until you publish it.");
      qc.invalidateQueries({ queryKey: ["admin-quiz-list"] });
      qc.invalidateQueries({ queryKey: ["admin-quizzes", courseId] });
      setTitle("");
      onCreated({ quizId, courseId: courseId!, method: method ?? "manual" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!method) {
    return (
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">New quiz</h2>
            <p className="text-xs text-foreground/60">How do you want to build it? You can still change everything later.</p>
          </div>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className="group text-left rounded-lg border p-4 transition hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <m.icon className="w-5 h-5 text-primary mb-2" />
              <p className="font-medium text-sm">{m.title}</p>
              <p className="text-xs text-foreground/60 mt-1">{m.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition">
                Continue <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  const chosen = METHODS.find((m) => m.key === method)!;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMethod(null)} className="px-2">
            <ArrowLeft className="w-3 h-3" />
          </Button>
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <chosen.icon className="w-4 h-4 text-primary" /> {chosen.title}
            </h2>
            <p className="text-xs text-foreground/60">Where should this quiz appear?</p>
          </div>
        </div>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>

      {!fixedCourseId && (
        <div>
          <Label className="text-xs">Course</Label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={courseId ?? ""}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setCourseId(v ? Number(v) : null);
              setModuleId(null);
              setLessonId(null);
            }}
          >
            <option value="">— select a course —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <Label className="text-xs">Placement</Label>
        <div className="grid sm:grid-cols-3 gap-2 mt-1">
          {([
            ["lesson", "Lesson quiz"],
            ["module", "Module exam"],
            ["course", "Course final exam"],
          ] as Array<[Scope, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={`rounded border px-3 py-2 text-sm text-left transition ${
                scope === value ? "border-primary bg-primary/10" : "hover:border-primary/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {scope === "lesson" && (
        <div>
          <Label className="text-xs">Lesson</Label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={lessonId ?? ""}
            onChange={(e) => setLessonId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
            disabled={!courseId}
          >
            <option value="">— select a lesson —</option>
            {courseLessons.map((l) => (
              <option key={l.id} value={l.id}>
                {courseModules.find((m) => m.id === l.module_id)?.title} · {l.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope === "module" && (
        <div>
          <Label className="text-xs">Module</Label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={moduleId ?? ""}
            onChange={(e) => setModuleId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
            disabled={!courseId}
          >
            <option value="">— select a module —</option>
            {courseModules.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <Label className="text-xs">Title (optional — we name it for you)</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave blank to auto-name" />
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {method === "ai" ? "Continue to AI generator" : method === "import" ? "Continue to import" : "Start writing questions"}
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
        <span className="text-[11px] text-foreground/60">
          Passing score 70% by default — adjust it in the editor.
        </span>
      </div>
    </Card>
  );
}