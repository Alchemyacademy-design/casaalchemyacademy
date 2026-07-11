import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, Save, RefreshCw, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  listCoursesRich, listModulesFull, listLessonsFull,
} from "@/manus/lib/course-management";

type DraftOption = { option_text: string; is_correct: boolean };
type DraftQuestion = { question_text: string; options: DraftOption[]; explanation: string };
type Draft = {
  title: string;
  description: string;
  passing_score: number;
  max_attempts: number;
  questions: DraftQuestion[];
};
type QuizType = "lesson" | "module" | "final";
type QuestionFormat = "mcq" | "mixed";

const TYPE_DEFAULTS: Record<QuizType, { passing: number; attempts: number; count: number }> = {
  lesson: { passing: 70, attempts: 3, count: 6 },
  module: { passing: 75, attempts: 3, count: 9 },
  final:  { passing: 80, attempts: 2, count: 13 },
};

function emptyOption(): DraftOption { return { option_text: "", is_correct: false }; }
function emptyQuestion(): DraftQuestion {
  return { question_text: "", explanation: "", options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()] };
}

export default function QuizContentAssistant() {
  const [collapsed, setCollapsed] = useState(false);
  const [quizType, setQuizType] = useState<QuizType>("lesson");
  const [questionFormat, setQuestionFormat] = useState<QuestionFormat>("mcq");
  const [courseId, setCourseId] = useState<string>("");
  const [moduleId, setModuleId] = useState<string>("");
  const [lessonId, setLessonId] = useState<string>("");
  const [instructions, setInstructions] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [questionCount, setQuestionCount] = useState(TYPE_DEFAULTS.lesson.count);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [scopeMeta, setScopeMeta] = useState<{ scope: string; source_counts: { lessons: number; blocks: number } } | null>(null);

  // Update sensible defaults whenever quiz type changes (only if user hasn't
  // customised beyond the previous defaults — keep this simple: always reset
  // count when type changes).
  useEffect(() => {
    setQuestionCount(TYPE_DEFAULTS[quizType].count);
    if (quizType === "final") { setModuleId(""); setLessonId(""); }
    if (quizType === "module") { setLessonId(""); }
  }, [quizType]);

  const coursesQ = useQuery({
    queryKey: ["assistant-courses"],
    queryFn: () => listCoursesRich({ pageSize: 100, sort: "title_asc" }),
  });
  const modulesQ = useQuery({
    queryKey: ["assistant-modules", courseId],
    queryFn: () => listModulesFull(Number(courseId)),
    enabled: !!courseId,
  });
  const lessonsQ = useQuery({
    queryKey: ["assistant-lessons", courseId, moduleId],
    queryFn: () => listLessonsFull([Number(moduleId)]),
    enabled: !!courseId && !!moduleId && quizType === "lesson",
  });

  const courseTitle = useMemo(() => {
    const c = coursesQ.data?.rows.find((r) => String(r.id) === courseId);
    return c?.title ?? "";
  }, [courseId, coursesQ.data]);

  const defaults = TYPE_DEFAULTS[quizType];

  async function generate() {
    if (!courseId) { toast.error("Select a course first"); return; }
    if (quizType === "module" && !moduleId) { toast.error("Select a module"); return; }
    if (quizType === "lesson" && (!moduleId || !lessonId)) { toast.error("Select a module and a lesson"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        draft: Draft; scope: string; source_counts: { lessons: number; blocks: number }; error?: string; detail?: string;
      }>("admin-quiz-assistant", {
        body: {
          course_id: Number(courseId),
          module_id: quizType === "final" ? null : (moduleId ? Number(moduleId) : null),
          lesson_id: quizType === "lesson" ? (lessonId ? Number(lessonId) : null) : null,
          quiz_type: quizType,
          question_format: questionFormat,
          instructions,
          extra_context: extraContext,
          question_count: questionCount,
        },
      });
      if (error) throw new Error(error.message);
      if (!data || data.error) {
        const map: Record<string, string> = {
          forbidden: "Admin role required.",
          course_not_found: "Course not found.",
          no_lessons_found: "No lessons available for that selection.",
          insufficient_content: "The selected lessons don't have enough text yet — add content first.",
          rate_limited: "AI rate limit reached. Please retry in a moment.",
          credits_exhausted: "Workspace AI credits exhausted. Add credits to continue.",
          ai_not_configured: "AI gateway not configured on this project.",
          ai_generation_failed: "AI generation failed. Please retry.",
        };
        throw new Error(map[data?.error ?? ""] ?? data?.error ?? "AI generation failed");
      }
      // Apply type-driven defaults if the AI returned wildly off values.
      const d = data.draft;
      setDraft({
        ...d,
        passing_score: d.passing_score || defaults.passing,
        max_attempts: d.max_attempts || defaults.attempts,
      });
      setScopeMeta({ scope: data.scope, source_counts: data.source_counts });
      toast.success("Draft generated — review before saving");
    } catch (e) {
      toast.error("Generation failed", { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  async function saveAsDraft() {
    if (!draft || !courseId) return;
    const invalid = draft.questions.some((q) =>
      !q.question_text.trim() || q.options.length < 2 || !q.options.some((o) => o.is_correct) ||
      q.options.filter((o) => o.is_correct).length !== 1 || q.options.some((o) => !o.option_text.trim())
    );
    if (invalid) { toast.error("Every question must have text, ≥2 options, all option texts filled, and exactly one correct answer."); return; }
    if (draft.questions.length === 0) { toast.error("Add at least one question."); return; }

    setSaving(true);
    try {
      // Enforce quiz_type mapping for module_id / lesson_id (not the raw dropdown state).
      let saveModuleId: number | null = null;
      let saveLessonId: number | null = null;
      if (quizType === "lesson") {
        saveLessonId = lessonId ? Number(lessonId) : null;
        // Derive module_id from the selected lesson for integrity.
        const l = (lessonsQ.data ?? []).find((x) => String(x.id) === lessonId);
        saveModuleId = l?.module_id ?? (moduleId ? Number(moduleId) : null);
      } else if (quizType === "module") {
        saveModuleId = moduleId ? Number(moduleId) : null;
      }

      const { data: quiz, error: qErr } = await supabase.from("quizzes").insert({
        course_id: Number(courseId),
        module_id: saveModuleId,
        lesson_id: saveLessonId,
        title: draft.title,
        description: draft.description || null,
        passing_score: draft.passing_score,
        max_attempts: draft.max_attempts,
        status: "draft",
      }).select("id").single();
      if (qErr) throw qErr;
      const quizId = quiz.id as number;

      for (let i = 0; i < draft.questions.length; i++) {
        const q = draft.questions[i];
        const { data: qRow, error: qqErr } = await supabase.from("quiz_questions").insert({
          quiz_id: quizId,
          question_text: q.question_text,
          explanation: q.explanation || null,
          points: 1,
          sort_order: i + 1,
        }).select("id").single();
        if (qqErr) throw qqErr;
        const questionId = qRow.id as number;
        const optionRows = q.options.map((o, idx) => ({
          question_id: questionId,
          option_text: o.option_text,
          is_correct: o.is_correct,
          sort_order: idx + 1,
        }));
        const { error: oErr } = await supabase.from("quiz_options").insert(optionRows);
        if (oErr) throw oErr;
      }

      toast.success("Quiz draft saved. Publish manually from Quiz bank when ready.");
      setDraft(null);
      setScopeMeta(null);
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function updateQuestion(idx: number, patch: Partial<DraftQuestion>) {
    if (!draft) return;
    const next = { ...draft, questions: draft.questions.map((q, i) => i === idx ? { ...q, ...patch } : q) };
    setDraft(next);
  }
  function updateOption(qIdx: number, oIdx: number, patch: Partial<DraftOption>) {
    if (!draft) return;
    const next = {
      ...draft,
      questions: draft.questions.map((q, i) => i !== qIdx ? q : {
        ...q,
        options: q.options.map((o, j) => j === oIdx ? { ...o, ...patch } : o),
      }),
    };
    setDraft(next);
  }
  function setCorrect(qIdx: number, oIdx: number) {
    if (!draft) return;
    const next = {
      ...draft,
      questions: draft.questions.map((q, i) => i !== qIdx ? q : {
        ...q,
        options: q.options.map((o, j) => ({ ...o, is_correct: j === oIdx })),
      }),
    };
    setDraft(next);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Content Assistant · Quiz draft generator
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)} className="gap-1">
            {collapsed ? <><ChevronDown className="w-4 h-4" /> Expand</> : <><ChevronUp className="w-4 h-4" /> Collapse</>}
          </Button>
        </CardHeader>
        {!collapsed && (
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/70">
            Generate a quiz draft grounded in real course content. Choose the quiz type (lesson, module, or final exam) —
            defaults for passing score, attempts and length adjust to the type. Nothing is saved until you click{" "}
            <strong>Save as Draft</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Quiz type</Label>
              <Select value={quizType} onValueChange={(v) => setQuizType(v as QuizType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lesson">Lesson Quiz — a single lesson</SelectItem>
                  <SelectItem value="module">Module Quiz — all lessons in a module</SelectItem>
                  <SelectItem value="final">Final Exam — whole course (cumulative)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Question format</Label>
              <Select value={questionFormat} onValueChange={(v) => setQuestionFormat(v as QuestionFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple choice only (4 options)</SelectItem>
                  <SelectItem value="mixed">Mixed — multiple choice + true/false</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Course</Label>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setModuleId(""); setLessonId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {(coursesQ.data?.rows ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {quizType !== "final" && (
              <div>
                <Label>Module{quizType === "lesson" ? "" : ""}</Label>
                <Select value={moduleId} onValueChange={(v) => { setModuleId(v); setLessonId(""); }} disabled={!courseId}>
                  <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                  <SelectContent>
                    {(modulesQ.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {quizType === "lesson" && (
              <div>
                <Label>Lesson</Label>
                <Select value={lessonId} onValueChange={setLessonId} disabled={!courseId || !moduleId}>
                  <SelectTrigger><SelectValue placeholder="Select lesson" /></SelectTrigger>
                  <SelectContent>
                    {(lessonsQ.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {quizType === "final" && (
              <div className="md:col-span-2 flex items-end">
                <p className="text-xs text-foreground/60">
                  Final Exam pulls content from <strong>all modules and all lessons</strong> of the selected course.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3">
              <Label>Extra instructions (optional)</Label>
              <Input
                placeholder="e.g. Focus on before/after transformation. Make it harder."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
            <div>
              <Label>Questions</Label>
              <Input
                type="number" min={3} max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(3, Math.min(20, Number(e.target.value) || defaults.count)))}
              />
            </div>
          </div>

          <div>
            <Label>Additional context / lesson transcript (optional)</Label>
            <Textarea
              rows={10}
              placeholder="Paste a lesson transcript, or any additional context, focus areas, or difficulty guidance. This is added to the real database content as an extra source of truth for the AI — it does not replace lesson content."
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              className="min-h-[220px] font-mono text-xs"
            />
            <p className="text-xs text-foreground/50 mt-1">
              {extraContext.length.toLocaleString()} characters · concatenated to the lesson/module content in the AI prompt.
            </p>
          </div>

          <p className="text-xs text-foreground/60">
            Suggested defaults for <strong>{quizType === "final" ? "Final Exam" : quizType === "module" ? "Module Quiz" : "Lesson Quiz"}</strong>:
            {" "}passing {defaults.passing}%, {defaults.attempts} attempts, ~{defaults.count} questions.
          </p>

          <div className="flex gap-2">
            <Button onClick={generate} disabled={!courseId || generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {draft ? "Regenerate draft" : "Generate draft"}
            </Button>
            {draft && (
              <Button variant="outline" onClick={() => { setDraft(null); setScopeMeta(null); }}>Discard</Button>
            )}
          </div>

          {scopeMeta && (
            <p className="text-xs text-foreground/60">
              Grounded in <strong>{scopeMeta.source_counts.lessons}</strong> lesson(s)
              {scopeMeta.source_counts.blocks > 0 ? ` and ${scopeMeta.source_counts.blocks} content block(s)` : ""}
              {" "}from <em>{courseTitle}</em>.
              {extraContext.trim().length > 0 ? ` Plus ${extraContext.length.toLocaleString()} characters of admin-supplied context.` : ""}
            </p>
          )}
        </CardContent>
        )}
      </Card>

      {draft && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Review draft</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={generate} disabled={generating} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Regenerate
              </Button>
              <Button onClick={saveAsDraft} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save as Draft
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Title</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Passing score (%)</Label>
                  <Input type="number" min={0} max={100} value={draft.passing_score}
                    onChange={(e) => setDraft({ ...draft, passing_score: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Max attempts</Label>
                  <Input type="number" min={1} max={20} value={draft.max_attempts}
                    onChange={(e) => setDraft({ ...draft, max_attempts: Number(e.target.value) || 1 })} />
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>

            <div className="space-y-4">
              {draft.questions.map((q, qIdx) => (
                <div key={qIdx} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Label className="mt-2">Question {qIdx + 1}</Label>
                    <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== qIdx) })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea rows={2} value={q.question_text}
                    onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })} />
                  <div className="space-y-2">
                    {q.options.map((o, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <Checkbox checked={o.is_correct} onCheckedChange={() => setCorrect(qIdx, oIdx)} />
                        <Input value={o.option_text}
                          onChange={(e) => updateOption(qIdx, oIdx, { option_text: e.target.value })}
                          placeholder={`Option ${oIdx + 1}`} />
                        <Button size="sm" variant="ghost"
                          onClick={() => updateQuestion(qIdx, { options: q.options.filter((_, j) => j !== oIdx) })}
                          disabled={q.options.length <= 2}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {q.options.length < 6 && (
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => updateQuestion(qIdx, { options: [...q.options, emptyOption()] })}>
                        <Plus className="w-3 h-3" /> Add option
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label>Explanation</Label>
                    <Textarea rows={2} value={q.explanation}
                      onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })} />
                  </div>
                </div>
              ))}
              <Button variant="outline" className="gap-2"
                onClick={() => setDraft({ ...draft, questions: [...draft.questions, emptyQuestion()] })}>
                <Plus className="w-4 h-4" /> Add question
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
