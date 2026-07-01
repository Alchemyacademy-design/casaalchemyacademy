import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import QuizCard from "@/manus/components/learning/QuizCard";
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

  const listQuery = useQuery({
    queryKey: ["admin-quizzes", courseId],
    queryFn: async () => {
      const { data, error } = await db
        .from("quizzes")
        .select("id,course_id,lesson_id,title,description,passing_score,max_attempts,status")
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
    mutationFn: async ({ quizId, lessonId }: { quizId: number; lessonId: number | null }) => {
      const { error } = await db.from("quizzes").update({ lesson_id: lessonId }).eq("id", quizId);
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
            Create lesson-scoped knowledge checks. Members see published quizzes inline on the matching lesson page.
          </p>
        </div>
        <Button size="sm" onClick={() => createQuiz.mutate()} disabled={createQuiz.isPending}>
          <Plus className="w-3 h-3 mr-1" /> New quiz
        </Button>
      </div>

      {listQuery.isLoading && <p className="text-xs text-foreground/60">Loading…</p>}
      {listQuery.error && (
        <p className="text-xs text-destructive">Failed to load quizzes: {errMsg(listQuery.error)}</p>
      )}

      <div className="space-y-2">
        {(listQuery.data ?? []).map((q) => (
          <div
            key={q.id}
            className={`border rounded-md p-3 flex items-center justify-between gap-3 ${
              activeQuizId === q.id ? "border-primary" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{q.title || "Untitled"}</p>
              <p className="text-[11px] text-foreground/60">
                {q.status} · passing {q.passing_score}% ·{" "}
                {q.max_attempts ? `${q.max_attempts} attempts` : "unlimited attempts"} ·{" "}
                {q.lesson_id
                  ? `lesson #${q.lesson_id}`
                  : "course-level draft scope"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Label className="text-[11px] text-foreground/60">Scope</Label>
                <select
                  value={q.lesson_id ?? ""}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setScope.mutate({ quizId: q.id, lessonId: v ? Number(v) : null });
                  }}
                  className="h-8 rounded border bg-background px-2 text-xs max-w-[280px]"
                  aria-label="Quiz scope"
                >
                  <option value="">Course-level / not shown in lesson player</option>
                  {(lessonsQuery.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.module_title} · {l.title}
                    </option>
                  ))}
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
            <p>No quizzes yet. Use “New quiz” above, choose the lesson Scope, and publish it so it appears inline for students.</p>
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

function QuizEditor({ quizId, courseId, onClose }: { quizId: number; courseId: number; onClose: () => void }) {
  const qc = useQueryClient();
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

  /** Toggle a single option as correct. Single-correct constraint enforced client-side. */
  const setSoleCorrect = async (questionId: number, optionId: number, options: ReadonlyArray<{ id: number; is_correct: boolean }>) => {
    for (const o of options) {
      if (o.id === optionId && !o.is_correct) await patchOption(o.id, { is_correct: true });
      else if (o.id !== optionId && o.is_correct) await patchOption(o.id, { is_correct: false });
    }
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
              if (next === "published" && !canPublish) {
                toast.error("Cannot publish: each question needs ≥2 options with exactly one correct.");
                return;
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
              {q.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={o.is_correct}
                    onChange={() => setSoleCorrect(q.id, o.id, q.options)}
                    aria-label="Correct option"
                  />
                  <Input
                    defaultValue={o.option_text}
                    onBlur={(e) => patchOption(o.id, { option_text: e.target.value })}
                    className="flex-1"
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
