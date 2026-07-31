/**
 * Quiz importer (admin-only).
 *
 * Admin uploads a .txt/.md/.pdf quiz or pastes one they wrote, we parse it into
 * questions + options, and show a visual review board where the admin confirms
 * / changes which option is correct before saving. Saving always produces a
 * DRAFT quiz — nothing becomes visible to students until it is published.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  FileUp,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  ACCEPTED_IMPORT_TYPES,
  extractTextFromFile,
  isUsableParse,
  parseQuizText,
  type ParsedQuestion,
} from "@/manus/lib/quiz-import";
import { saveQuizQuestions, type SaveMode } from "@/manus/services/quiz-admin";

type Props = {
  quizId: number;
  quizTitle: string;
  existingQuestionCount: number;
  onSaved: (info: { title?: string }) => void;
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

const SAMPLE = `Title: Colour foundations
1. What does the 60-30-10 rule describe?
a) Lighting temperature
b) Colour proportion in a room
c) Furniture spacing
Answer: B
Explanation: It splits a palette into dominant, secondary and accent.`;

export default function QuizImportPanel({ quizId, quizTitle, existingQuestionCount, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[] | null>(null);
  const [detectedTitle, setDetectedTitle] = useState("");
  const [busy, setBusy] = useState<null | "extract" | "parse" | "ai" | "save">(null);
  const [mode, setMode] = useState<SaveMode>(existingQuestionCount > 0 ? "append" : "replace");

  const readyCount = (questions ?? []).filter(
    (q) => q.question_text.trim() && q.options.filter((o) => o.option_text.trim()).length >= 2,
  ).length;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy("extract");
    try {
      const text = await extractTextFromFile(file);
      setRawText(text);
      setSourceName(file.name);
      const parsed = parseQuizText(text);
      if (isUsableParse(parsed)) {
        setQuestions(parsed.questions);
        setDetectedTitle(parsed.title);
        toast.success(`${parsed.questions.length} question(s) detected from ${file.name}`);
      } else {
        setQuestions(null);
        toast.info("Structure not recognised automatically — use “Structure with AI”.");
      }
    } catch (e) {
      toast.error("Could not read file", { description: errMsg(e) });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const parseLocally = () => {
    setBusy("parse");
    try {
      const parsed = parseQuizText(rawText);
      if (!isUsableParse(parsed)) {
        toast.info("Could not recognise the structure — try “Structure with AI”.");
        return;
      }
      setQuestions(parsed.questions);
      setDetectedTitle(parsed.title);
      toast.success(`${parsed.questions.length} question(s) detected`);
    } finally {
      setBusy(null);
    }
  };

  const structureWithAi = async () => {
    if (rawText.replace(/\s+/g, "").length < 40) {
      toast.error("Paste or upload the quiz text first.");
      return;
    }
    setBusy("ai");
    try {
      const { data, error } = await supabase.functions.invoke<{
        draft?: { title: string; description: string; questions: ParsedQuestion[] };
        error?: string;
      }>("admin-quiz-import", { body: { raw_text: rawText, source_name: sourceName ?? "" } });
      if (error) throw new Error(error.message);
      const map: Record<string, string> = {
        forbidden: "Admin role required.",
        insufficient_text: "Not enough text to work with.",
        no_questions_detected: "No questions could be detected in this file.",
        rate_limited: "AI rate limit reached — retry in a moment.",
        credits_exhausted: "Workspace AI credits exhausted.",
        ai_not_configured: "AI gateway not configured.",
      };
      if (!data || data.error || !data.draft) {
        throw new Error(map[data?.error ?? ""] ?? "Structuring failed");
      }
      setQuestions(data.draft.questions);
      setDetectedTitle(data.draft.title);
      toast.success(`${data.draft.questions.length} question(s) structured. Review the correct answers.`);
    } catch (e) {
      toast.error("Structuring failed", { description: errMsg(e) });
    } finally {
      setBusy(null);
    }
  };

  const patchQuestion = (qi: number, patch: Partial<ParsedQuestion>) => {
    setQuestions((prev) => (prev ? prev.map((q, i) => (i === qi ? { ...q, ...patch } : q)) : prev));
  };
  const patchOption = (qi: number, oi: number, text: string) => {
    setQuestions((prev) =>
      prev
        ? prev.map((q, i) =>
            i === qi
              ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, option_text: text } : o)) }
              : q,
          )
        : prev,
    );
  };
  const setCorrect = (qi: number, oi: number) => {
    setQuestions((prev) =>
      prev
        ? prev.map((q, i) =>
            i === qi ? { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })) } : q,
          )
        : prev,
    );
  };
  const addOption = (qi: number) => {
    setQuestions((prev) =>
      prev
        ? prev.map((q, i) =>
            i === qi ? { ...q, options: [...q.options, { option_text: "", is_correct: false }] } : q,
          )
        : prev,
    );
  };
  const removeOption = (qi: number, oi: number) => {
    setQuestions((prev) =>
      prev
        ? prev.map((q, i) => {
            if (i !== qi) return q;
            const options = q.options.filter((_, j) => j !== oi);
            if (!options.some((o) => o.is_correct) && options[0]) options[0] = { ...options[0], is_correct: true };
            return { ...q, options };
          })
        : prev,
    );
  };
  const removeQuestion = (qi: number) => {
    setQuestions((prev) => (prev ? prev.filter((_, i) => i !== qi) : prev));
  };

  const save = async () => {
    if (!questions || readyCount === 0) return;
    if (mode === "replace" && existingQuestionCount > 0) {
      const ok = confirm(
        `Replace the ${existingQuestionCount} existing question(s) of this quiz with the ${readyCount} imported one(s)?`,
      );
      if (!ok) return;
    }
    setBusy("save");
    try {
      const written = await saveQuizQuestions(quizId, questions, mode);
      toast.success(`${written} question(s) saved as draft`, {
        description: "Review and publish when you're ready.",
      });
      setQuestions(null);
      setRawText("");
      setSourceName(null);
      onSaved({ title: detectedTitle || undefined });
    } catch (e) {
      toast.error("Save failed", { description: errMsg(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4 space-y-4 border-dashed bg-muted/20">
      <div className="flex flex-wrap items-center gap-2">
        <Upload className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">Import a quiz</h4>
        <span className="text-[11px] text-foreground/60">
          · upload .txt / .md / .pdf, or paste your own quiz
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMPORT_TYPES}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={busy != null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "extract" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3" />}
          Choose file
        </Button>
        {sourceName && <Badge variant="secondary" className="text-[11px]">{sourceName}</Badge>}
      </div>

      <div>
        <Label className="text-xs">Quiz text</Label>
        <Textarea
          rows={8}
          className="min-h-[160px] font-mono text-xs"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={SAMPLE}
        />
        <p className="text-[11px] text-foreground/50 mt-1">
          {rawText.length.toLocaleString()} characters · markers understood: <code>*a)</code>, <code>[x]</code>,{" "}
          <code>(correct)</code>, <code>Answer: B</code>, <code>Resposta: C</code>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-2" disabled={busy != null || !rawText.trim()} onClick={parseLocally}>
          {busy === "parse" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          Detect questions
        </Button>
        <Button size="sm" variant="outline" className="gap-2" disabled={busy != null || !rawText.trim()} onClick={structureWithAi}>
          {busy === "ai" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Structure with AI
        </Button>
      </div>

      {questions && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold">
              Review · {readyCount} question(s) ready
              {detectedTitle && <span className="font-normal text-foreground/60"> · detected title “{detectedTitle}”</span>}
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-foreground/60">On save</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.currentTarget.value as SaveMode)}
                className="h-8 rounded border bg-background px-2 text-xs"
                aria-label="Save mode"
              >
                <option value="append">Add to existing questions</option>
                <option value="replace">Replace all questions</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-foreground/60">
            Click an option to mark it as the correct answer. Green = correct answer used for grading.
          </p>

          {questions.map((q, qi) => (
            <Card key={qi} className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-mono text-foreground/50 mt-2">{qi + 1}.</span>
                <Input
                  value={q.question_text}
                  onChange={(e) => patchQuestion(qi, { question_text: e.target.value })}
                  className="flex-1"
                />
                <button
                  onClick={() => removeQuestion(qi)}
                  className="text-red-600 hover:text-red-700 p-1"
                  aria-label={`Remove question ${qi + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1 pl-6">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrect(qi, oi)}
                      aria-pressed={o.is_correct}
                      aria-label={`Mark option ${oi + 1} of question ${qi + 1} as correct`}
                      className={`shrink-0 h-6 w-6 rounded-full border flex items-center justify-center transition ${
                        o.is_correct
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-border text-transparent hover:border-emerald-400"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <Input
                      value={o.option_text}
                      onChange={(e) => patchOption(qi, oi, e.target.value)}
                      className={`flex-1 ${o.is_correct ? "border-emerald-500/60 bg-emerald-500/5" : ""}`}
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    />
                    <button
                      onClick={() => removeOption(qi, oi)}
                      className="text-red-600 hover:text-red-700 p-1"
                      aria-label={`Remove option ${oi + 1}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => addOption(qi)}>
                  <Plus className="w-3 h-3 mr-1" /> Add option
                </Button>
              </div>
              <Textarea
                rows={2}
                value={q.explanation}
                onChange={(e) => patchQuestion(qi, { explanation: e.target.value })}
                placeholder="Optional explanation shown after grading"
              />
            </Card>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="gap-2" disabled={busy != null || readyCount === 0} onClick={save}>
              {busy === "save" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save as draft ({readyCount})
            </Button>
            <Button size="sm" variant="ghost" disabled={busy != null} onClick={() => setQuestions(null)}>
              Discard
            </Button>
            <span className="text-[11px] text-foreground/60">
              Saved into “{quizTitle || "Untitled quiz"}” — stays a draft until you publish it.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}