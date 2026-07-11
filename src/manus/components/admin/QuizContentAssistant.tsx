import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, Save, RefreshCw, Trash2, Plus } from "lucide-react";
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

function emptyOption(): DraftOption { return { option_text: "", is_correct: false }; }
function emptyQuestion(): DraftQuestion {
  return { question_text: "", explanation: "", options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()] };
}

export default function QuizContentAssistant() {
  const [courseId, setCourseId] = useState<string>("");
  const [moduleId, setModuleId] = useState<string>("all");
  const [lessonId, setLessonId] = useState<string>("all");
  const [instructions, setInstructions] = useState("");
  const [questionCount, setQuestionCount] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [scopeMeta, setScopeMeta] = useState<{ scope: string; source_counts: { lessons: number; blocks: number } } | null>(null);

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
    queryFn: async () => {
      if (moduleId === "all") {
        const mods = modulesQ.data ?? [];
        return listLessonsFull(mods.map((m) => m.id));
      }
      return listLessonsFull([Number(moduleId)]);
    },
    enabled: !!courseId && (modulesQ.data?.length ?? 0) > 0,
  });

  const courseTitle = useMemo(() => {
    const c = coursesQ.data?.rows.find((r) => String(r.id) === courseId);
    return c?.title ?? "";
  }, [courseId, coursesQ.data]);

  async function generate() {
    if (!courseId) { toast.error("Select a course first"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        draft: Draft; scope: string; source_counts: { lessons: number; blocks: number }; error?: string; detail?: string;
      }>("admin-quiz-assistant", {
        body: {
          course_id: Number(courseId),
          module_id: moduleId !== "all" ? Number(moduleId) : null,
          lesson_id: lessonId !== "all" ? Number(lessonId) : null,
          instructions,
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
      setDraft(data.draft);
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
      const { data: quiz, error: qErr } = await supabase.from("quizzes").insert({
        course_id: Number(courseId),
        module_id: moduleId !== "all" ? Number(moduleId) : null,
        lesson_id: lessonId !== "all" ? Number(lessonId) : null,
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Content Assistant · Quiz draft generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/70">
            Select a course (optionally a module/lesson) and generate a quiz draft grounded in the real lesson content.
            The AI never invents theory outside the material. Nothing is saved until you click <strong>Save as Draft</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Course</Label>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setModuleId("all"); setLessonId("all"); }}>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {(coursesQ.data?.rows ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Module (optional)</Label>
              <Select value={moduleId} onValueChange={(v) => { setModuleId(v); setLessonId("all"); }} disabled={!courseId}>
                <SelectTrigger><SelectValue placeholder="All modules" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {(modulesQ.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lesson (optional)</Label>
              <Select value={lessonId} onValueChange={setLessonId} disabled={!courseId || moduleId === "all"}>
                <SelectTrigger><SelectValue placeholder="All lessons in module" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All lessons in module</SelectItem>
                  {(lessonsQ.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                type="number" min={3} max={15}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(3, Math.min(15, Number(e.target.value) || 8)))}
              />
            </div>
          </div>

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
            </p>
          )}
        </CardContent>
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
