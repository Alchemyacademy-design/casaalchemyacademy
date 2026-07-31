import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Eye, Plus, Trash2, Sparkles, Loader2, FileUp, PencilLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import QuizCard from "@/manus/components/learning/QuizCard";
import QuizImportPanel from "@/manus/components/admin/QuizImportPanel";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  isQuestionPublishable,
  isQuizPublishable,
  loadAdminQuiz,
  type AdminQuestion,
  type QuizRow,
  type QuizStatus,
} from "@/manus/services/quiz";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

type Props = { courseId: number };

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

type CourseLessonOption = { id: number; title: string; module_title: string; sort_order: number };

export default function AdminQuizEditor({ courseId }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | QuizStatus>("all");

  const listQuery = useQuery({
    queryKey: ["admin-quizzes", courseId],
    queryFn: async () => {
      const { data, error } = await db
        .from("quizzes")
        .select("id,course_id,lesson_id,module_id,title,description,passing_score,max_attempts,status")
        .eq("course_id", courseId)
        .order("id");
      if (error) throw error;
      return (data ?? []) as QuizRow[];
    },
    enabled: Number.isFinite(courseId) && courseId > 0,
  });

  // Lesson pool for the scope picker — lets admins bind a quiz to a specific
  // lesson so it renders on that lesson page instead of only at the end.
  const lessonsQuery = useQuery({
    queryKey: ["admin-quiz-lesson-pool", courseId],
    enabled: Number.isFinite(courseId) && courseId > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("course_modules")
        .select("id,title,sort_order,lessons(id,title,sort_order)")
        .eq("course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      const out: CourseLessonOption[] = [];
      for (const m of (data ?? []) as Array<{
        id: number;
        title: string;
        sort_order: number;
        lessons: Array<{ id: number; title: string; sort_order: number }> | null;
      }>) {
        for (const l of (m.lessons ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)) {
          out.push({ id: l.id, title: l.title, module_title: m.title, sort_order: l.sort_order });
        }
      }
      return out;
    },
  });

  const modulesQuery = useQuery({
    queryKey: ["admin-quiz-module-pool", courseId],
    enabled: Number.isFinite(courseId) && courseId > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("course_modules")
        .select("id,title,sort_order")
        .eq("course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Array<{ id: number; title: string; sort_order: number }>;
    },
  });

  const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
  const [previewQuizId, setPreviewQuizId] = useState<number | null>(null);

  const createQuiz = useMutation({
    mutationFn: async () => {
      const { data, error } = await db
        .from("quizzes")
        .insert({ course_id: courseId, title: "Untitled quiz", passing_score: 70, status: "draft" })
        .select()
        .single();
      if (error) throw error;
      return data as QuizRow;
    },
    onSuccess: (q) => {
      toast.success("Quiz created");
      setActiveQuizId(q.id);
      qc.invalidateQueries({ queryKey: ["admin-quizzes", courseId] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const setScope = useMutation({
    mutationFn: async ({
      quizId,
      lessonId,
      moduleId,
    }: {
      quizId: number;
      lessonId: number | null;
      moduleId: number | null;
    }) => {
      const { error } = await db
        .from("quizzes")
        .update({ lesson_id: lessonId, module_id: moduleId })
        .eq("id", quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quiz scope updated");
      qc.invalidateQueries({ queryKey: ["admin-quizzes", courseId] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Quizzes</h2>
          <p className="text-xs text-foreground/60">
            Create lesson-scoped knowledge checks. Drafts are saved automatically and stay hidden from students —
            only published quizzes appear on the matching lesson, module or course page.
          </p>
        </div>
        <Button size="sm" onClick={() => createQuiz.mutate()} disabled={createQuiz.isPending}>
          <Plus className="w-3 h-3 mr-1" /> New quiz
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {(["all", "draft", "published", "archived"] as const).map((s) => {
          const count =
            s === "all"
              ? (listQuery.data ?? []).length
              : (listQuery.data ?? []).filter((q) => q.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[11px] rounded-full border px-3 py-1 capitalize transition ${
                statusFilter === s ? "border-primary bg-primary/10 text-foreground" : "text-foreground/60"
              }`}
            >
              {s === "all" ? "All" : s} ({count})
            </button>
          );
        })}
      </div>

      {listQuery.isLoading && <p className="text-xs text-foreground/60">Loading…</p>}
      {listQuery.error && (
        <p className="text-xs text-destructive">Failed to load quizzes: {errMsg(listQuery.error)}</p>
      )}

      <div className="space-y-2">
        {(listQuery.data ?? [])
          .filter((q) => statusFilter === "all" || q.status === statusFilter)
          .map((q) => (
          <div
            key={q.id}
            className={`border rounded-md p-3 flex items-center justify-between gap-3 ${
              activeQuizId === q.id ? "border-primary" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate flex items-center gap-2">
                <span className="truncate">{q.title || "Untitled"}</span>
                <Badge
                  variant={q.status === "published" ? "default" : "secondary"}
                  className="text-[10px] shrink-0 capitalize"
                >
                  {q.status}
                </Badge>
              </p>
              <p className="text-[11px] text-foreground/60">
                passing {q.passing_score}% ·{" "}
                {q.max_attempts ? `${q.max_attempts} attempts` : "unlimited attempts"} ·{" "}
                {q.lesson_id
                  ? `lesson #${q.lesson_id}`
                  : q.module_id
                  ? `module exam #${q.module_id}`
                  : "course final exam"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Label className="text-[11px] text-foreground/60">Scope</Label>
                <select
                  value={q.lesson_id ? `L${q.lesson_id}` : q.module_id ? `M${q.module_id}` : "C"}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v === "C") {
                      setScope.mutate({ quizId: q.id, lessonId: null, moduleId: null });
                    } else if (v.startsWith("L")) {
                      setScope.mutate({ quizId: q.id, lessonId: Number(v.slice(1)), moduleId: null });
                    } else if (v.startsWith("M")) {
                      setScope.mutate({ quizId: q.id, lessonId: null, moduleId: Number(v.slice(1)) });
                    }
                  }}
                  className="h-8 rounded border bg-background px-2 text-xs max-w-[320px]"
                  aria-label="Quiz scope"
                >
                  <option value="C">Course final exam</option>
                  <optgroup label="Lesson quiz">
                    {(lessonsQuery.data ?? []).map((l) => (
                      <option key={`L${l.id}`} value={`L${l.id}`}>
                        {l.module_title} · {l.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Module exam">
                    {(modulesQuery.data ?? []).map((m) => (
                      <option key={`M${m.id}`} value={`M${m.id}`}>{m.title}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewQuizId((id) => (id === q.id ? null : q.id))}
                title="Preview quiz without creating an attempt"
              >
                <Eye className="w-3 h-3 mr-1" />
                {previewQuizId === q.id ? "Hide preview" : "Preview"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setActiveQuizId(q.id)}>
                {activeQuizId === q.id ? "Editing" : "Edit"}
              </Button>
            </div>
          </div>
        ))}
        {(listQuery.data ?? []).length === 0 && !listQuery.isLoading && (
          <div className="text-xs text-foreground/60">
            <p>No quizzes yet. Use “New quiz” above, choose the Scope (lesson / module exam / course final exam), and publish it so it appears for students.</p>
          </div>
        )}
      </div>

      {previewQuizId != null && (
        <div className="border-t pt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-foreground/60">Preview · no attempt is recorded</p>
          <QuizCard quizId={previewQuizId} previewAsAdmin />
        </div>
      )}

      {activeQuizId != null && (
        <QuizEditor quizId={activeQuizId} courseId={courseId} onClose={() => setActiveQuizId(null)} />
      )}
    </Card>
  );
}

export type QuizEditorTool = "ai" | "import" | "manual";

export function QuizEditor({
  quizId,
  courseId,
  onClose,
  initialTool = "manual",
}: {
  quizId: number;
  courseId: number;
  onClose: () => void;
  initialTool?: QuizEditorTool;
}) {
  const qc = useQueryClient();
  const [tool, setTool] = useState<QuizEditorTool>(initialTool);
  const quizQuery = useQuery({
    queryKey: ["admin-quiz", quizId],
    queryFn: () => loadAdminQuiz(quizId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-quiz", quizId] });
    qc.invalidateQueries({ queryKey: ["admin-quizzes", courseId] });
  };

  const patchQuiz = async (patch: Partial<QuizRow>) => {
    const { error } = await db.from("quizzes").update(patch).eq("id", quizId);
    if (error) throw error;
    invalidate();
  };

  const addQuestion = async () => {
    const next = (quizQuery.data?.questions ?? []).length + 1;
    const { data, error } = await db
      .from("quiz_questions")
      .insert({ quiz_id: quizId, question_text: "New question", points: 1, sort_order: next })
      .select()
      .single();
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    // Seed with 2 empty options so it is publishable once filled.
    await db.from("quiz_options").insert([
      { question_id: data.id, option_text: "Option A", is_correct: true, sort_order: 1 },
      { question_id: data.id, option_text: "Option B", is_correct: false, sort_order: 2 },
    ]);
    invalidate();
  };

  const removeQuestion = async (questionId: number) => {
    if (!confirm("Remove this question? This permanently deletes its options and any prior answers.")) return;
    const { error } = await db.from("quiz_questions").delete().eq("id", questionId);
    if (error) toast.error(errMsg(error));
    else invalidate();
  };

  const patchQuestion = async (questionId: number, patch: Partial<AdminQuestion>) => {
    const { error } = await db.from("quiz_questions").update(patch).eq("id", questionId);
    if (error) toast.error(errMsg(error));
    else invalidate();
  };

  const addOption = async (questionId: number, sort: number) => {
    const { error } = await db
      .from("quiz_options")
      .insert({ question_id: questionId, option_text: "New option", is_correct: false, sort_order: sort });
    if (error) toast.error(errMsg(error));
    else invalidate();
  };

  const patchOption = async (
    optionId: number,
    patch: Partial<{ option_text: string; is_correct: boolean; sort_order: number }>,
  ) => {
    const { error } = await db.from("quiz_options").update(patch).eq("id", optionId);
    if (error) toast.error(errMsg(error));
    else invalidate();
  };

  const removeOption = async (optionId: number) => {
    const { error } = await db.from("quiz_options").delete().eq("id", optionId);
    if (error) toast.error(errMsg(error));
    else invalidate();
  };

  /**
   * Mark exactly one option as the correct answer. Writes the whole question's
   * options in one pass (clear others, then set the chosen one) so the editor
   * can never leave a question with zero or two correct answers.
   */
  const setSoleCorrect = async (
    questionId: number,
    optionId: number,
    options: ReadonlyArray<{ id: number; is_correct: boolean }>,
  ) => {
    const others = options.filter((o) => o.id !== optionId && o.is_correct).map((o) => o.id);
    if (others.length > 0) {
      const { error } = await db.from("quiz_options").update({ is_correct: false }).in("id", others);
      if (error) { toast.error(errMsg(error)); return; }
    }
    const { error } = await db.from("quiz_options").update({ is_correct: true }).eq("id", optionId);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate();
  };

  if (quizQuery.isLoading) return <Card className="p-4 text-xs">Loading editor…</Card>;
  if (!quizQuery.data) return <Card className="p-4 text-xs text-destructive">Quiz not found.</Card>;

  const { quiz, questions } = quizQuery.data;
  const canPublish = isQuizPublishable(quiz, questions);

  return (
    <Card className="p-5 space-y-4 border-primary/40">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Edit quiz #{quiz.id}</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
        {([
          ["ai", "Create with AI", Sparkles],
          ["import", "Import a ready quiz", FileUp],
          ["manual", "Write manually", PencilLine],
        ] as Array<[QuizEditorTool, string, typeof Sparkles]>).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTool(value)}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition ${
              tool === value ? "bg-background shadow-sm font-medium" : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>

      {tool === "ai" && (
        <QuizAssistantPanel
          quiz={quiz}
          courseId={courseId}
          existingQuestionCount={questions.length}
          onApplied={invalidate}
        />
      )}

      {tool === "import" && (
        <QuizImportPanel
          quizId={quiz.id}
          quizTitle={quiz.title}
          existingQuestionCount={questions.length}
          onSaved={({ title }) => {
            if (title && (!quiz.title || quiz.title === "Untitled quiz")) {
              patchQuiz({ title }).catch(() => undefined);
            }
            invalidate();
          }}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Title</Label>
          <Input defaultValue={quiz.title} onBlur={(e) => patchQuiz({ title: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Passing score (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={quiz.passing_score}
            onBlur={(e) => patchQuiz({ passing_score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
          />
        </div>
        <div>
          <Label className="text-xs">Max attempts (blank = unlimited)</Label>
          <Input
            type="number"
            min={1}
            defaultValue={quiz.max_attempts ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              patchQuiz({ max_attempts: v ? Math.max(1, Number(v) || 1) : null });
            }}
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <select
            value={quiz.status}
            onChange={(e) => {
              const next = e.currentTarget.value as QuizStatus;
              if (next === "published") {
                if (!canPublish) {
                  toast.error("Cannot publish: each question needs ≥2 options with exactly one correct.");
                  return;
                }
              }
              patchQuiz({ status: next });
            }}
            className="h-9 w-full rounded border bg-background px-2 text-xs"
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea defaultValue={quiz.description ?? ""} onBlur={(e) => patchQuiz({ description: e.target.value.trim() || null })} rows={2} />
        </div>
      </div>

      <p className="text-xs text-foreground/60">
        Scope:{" "}
        {quiz.lesson_id
          ? `Lesson quiz (#${quiz.lesson_id}) — shown inline on that lesson.`
          : quiz.module_id
          ? `Module exam (#${quiz.module_id}) — shown at end of that module.`
          : "Course final exam — shown on the course page after all modules."}
      </p>
      {!canPublish && (
        <p className="text-xs text-amber-700">
          To publish, give the quiz a title and ensure every question has at least 2 options with exactly one marked correct.
        </p>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Questions ({questions.length})</h4>
          <Button size="sm" variant="outline" onClick={addQuestion}>
            <Plus className="w-3 h-3 mr-1" /> Add question
          </Button>
        </div>
        {questions.map((q, qi) => (
          <Card key={q.id} className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-mono text-foreground/50 mt-2">{qi + 1}.</span>
              <Input
                defaultValue={q.question_text}
                onBlur={(e) => patchQuestion(q.id, { question_text: e.target.value })}
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                defaultValue={q.points}
                onBlur={(e) => patchQuestion(q.id, { points: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20"
                aria-label="Points"
              />
              <button
                onClick={() => removeQuestion(q.id)}
                className="text-red-600 hover:text-red-700 p-1"
                aria-label="Remove question"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              defaultValue={q.explanation ?? ""}
              onBlur={(e) => patchQuestion(q.id, { explanation: e.target.value.trim() || null })}
              placeholder="Optional explanation shown after grading"
              rows={2}
            />
            <div className="space-y-1 pl-4">
              <p className="text-[11px] text-foreground/55">
                Click the circle to set the correct answer. Green = the answer used for grading.
              </p>
              {q.options.map((o, oi) => (
                <div key={o.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={o.is_correct}
                    aria-label={`Mark option ${String.fromCharCode(65 + oi)} as the correct answer`}
                    onClick={() => setSoleCorrect(q.id, o.id, q.options)}
                    className={`shrink-0 h-6 w-6 rounded-full border flex items-center justify-center transition ${
                      o.is_correct
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-border text-transparent hover:border-emerald-400"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <span className="text-[11px] font-mono text-foreground/50 w-4">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <Input
                    defaultValue={o.option_text}
                    onBlur={(e) => patchOption(o.id, { option_text: e.target.value })}
                    className={`flex-1 ${o.is_correct ? "border-emerald-500/60 bg-emerald-500/5" : ""}`}
                  />
                  <button
                    onClick={() => removeOption(o.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                    aria-label="Remove option"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addOption(q.id, q.options.length + 1)}
              >
                <Plus className="w-3 h-3 mr-1" /> Add option
              </Button>
              {!isQuestionPublishable(q.options) && (
                <p className="text-[11px] text-amber-700">
                  Needs ≥2 options with exactly one correct to publish.
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}

type AssistantScope = "lesson" | "module" | "final";
type AssistantFormat = "mcq" | "mixed";
type AssistantDraft = {
  title: string;
  description: string;
  passing_score: number;
  max_attempts: number;
  questions: Array<{
    question_text: string;
    explanation: string;
    options: Array<{ option_text: string; is_correct: boolean }>;
  }>;
};

const ASSIST_DEFAULT_COUNT: Record<AssistantScope, number> = { lesson: 6, module: 9, final: 13 };

function QuizAssistantPanel({
  quiz,
  courseId,
  existingQuestionCount,
  onApplied,
}: {
  quiz: QuizRow;
  courseId: number;
  existingQuestionCount: number;
  onApplied: () => void;
}) {
  const scope: AssistantScope = quiz.lesson_id ? "lesson" : quiz.module_id ? "module" : "final";
  const [extraContext, setExtraContext] = useState("");
  const [format, setFormat] = useState<AssistantFormat>("mcq");
  const [count, setCount] = useState<number>(ASSIST_DEFAULT_COUNT[scope]);
  const [busy, setBusy] = useState(false);

  const scopeLabel =
    scope === "lesson" ? `Lesson quiz (lesson #${quiz.lesson_id})`
    : scope === "module" ? `Module exam (module #${quiz.module_id})`
    : "Course final exam (whole course)";

  const errorMap: Record<string, string> = {
    forbidden: "Admin role required.",
    course_not_found: "Course not found.",
    no_lessons_found: "No lessons available for this scope.",
    insufficient_content: "Not enough lesson content yet — add content or paste a transcript below.",
    rate_limited: "AI rate limit reached. Please retry in a moment.",
    credits_exhausted: "Workspace AI credits exhausted. Add credits to continue.",
    ai_not_configured: "AI gateway not configured on this project.",
    ai_generation_failed: "AI generation failed. Please retry.",
    content_load_failed: "Failed to load course content.",
  };

  const generate = async () => {
    if (existingQuestionCount > 0) {
      const ok = confirm(
        `This quiz already has ${existingQuestionCount} question(s). Replace them with the AI-generated ones? This cannot be undone.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        draft: AssistantDraft; error?: string; detail?: string;
      }>("admin-quiz-assistant", {
        body: {
          course_id: courseId,
          module_id: scope === "final" ? null : quiz.module_id ?? null,
          lesson_id: scope === "lesson" ? quiz.lesson_id ?? null : null,
          quiz_type: scope,
          question_format: format,
          extra_context: extraContext,
          question_count: count,
        },
      });
      if (error) throw new Error(error.message);
      if (!data || data.error || !data.draft) {
        throw new Error(errorMap[data?.error ?? ""] ?? data?.error ?? "AI generation failed");
      }
      const draft = data.draft;

      // 1. Patch quiz metadata
      const { error: pErr } = await db.from("quizzes").update({
        title: draft.title || quiz.title,
        description: draft.description || null,
        passing_score: draft.passing_score || quiz.passing_score,
        max_attempts: draft.max_attempts || quiz.max_attempts,
      }).eq("id", quiz.id);
      if (pErr) throw pErr;

      // 2. Delete existing questions (options cascade)
      if (existingQuestionCount > 0) {
        const { error: dErr } = await db.from("quiz_questions").delete().eq("quiz_id", quiz.id);
        if (dErr) throw dErr;
      }

      // 3. Insert new questions + options sequentially
      for (let i = 0; i < draft.questions.length; i++) {
        const q = draft.questions[i];
        const { data: qRow, error: qErr } = await db.from("quiz_questions").insert({
          quiz_id: quiz.id,
          question_text: q.question_text,
          explanation: q.explanation || null,
          points: 1,
          sort_order: i + 1,
        }).select("id").single();
        if (qErr) throw qErr;
        const optionRows = q.options.map((o, idx) => ({
          question_id: qRow.id as number,
          option_text: o.option_text,
          is_correct: o.is_correct,
          sort_order: idx + 1,
        }));
        const { error: oErr } = await db.from("quiz_options").insert(optionRows);
        if (oErr) throw oErr;
      }

      toast.success(`Generated ${draft.questions.length} question(s). Review and edit before publishing.`);
      onApplied();
    } catch (e) {
      toast.error("Generation failed", { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3 border-dashed bg-muted/30">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">Generate with AI</h4>
        <span className="text-[11px] text-foreground/60">· {scopeLabel}</span>
      </div>
      <p className="text-xs text-foreground/60">
        Uses the real content of this quiz's scope. Paste a transcript or extra context below to add to it —
        the AI treats it as an additional source of truth, not a replacement.
      </p>

      <div>
        <Label className="text-xs">Additional context / lesson transcript (optional)</Label>
        <Textarea
          rows={8}
          className="min-h-[180px] font-mono text-xs"
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          placeholder="Paste the lesson transcript or any additional context/focus/difficulty guidance…"
        />
        <p className="text-[11px] text-foreground/50 mt-1">
          {extraContext.length.toLocaleString()} characters
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Questions to generate</Label>
          <Input
            type="number" min={3} max={20}
            value={count}
            onChange={(e) => setCount(Math.max(3, Math.min(20, Number(e.target.value) || ASSIST_DEFAULT_COUNT[scope])))}
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Question format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as AssistantFormat)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mcq">Multiple choice only (4 options)</SelectItem>
              <SelectItem value="mixed">Mixed — multiple choice + true/false</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={generate} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Generate with AI
        </Button>
        {existingQuestionCount > 0 && (
          <span className="text-[11px] text-amber-700">
            Will replace {existingQuestionCount} existing question(s) after confirmation.
          </span>
        )}
      </div>
    </Card>
  );
}
