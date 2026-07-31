/**
 * Admin-side quiz writes. Kept in one place so the editor, the AI assistant
 * and the file importer all persist questions exactly the same way.
 *
 * Access control lives in the database (admin-only RLS on quiz_questions /
 * quiz_options); this module only shapes the payload.
 */

import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export type DraftOptionInput = { option_text: string; is_correct: boolean };
export type DraftQuestionInput = {
  question_text: string;
  explanation?: string | null;
  points?: number;
  options: DraftOptionInput[];
};

export type SaveMode = "replace" | "append";

/** Normalise a draft: trim, drop empties, force exactly one correct option. */
export function normalizeDraftQuestions(questions: ReadonlyArray<DraftQuestionInput>): DraftQuestionInput[] {
  return questions
    .map((q) => {
      const options = q.options
        .map((o) => ({ option_text: o.option_text.trim(), is_correct: Boolean(o.is_correct) }))
        .filter((o) => o.option_text.length > 0)
        .slice(0, 8);
      const firstCorrect = options.findIndex((o) => o.is_correct);
      const correctIdx = firstCorrect === -1 ? 0 : firstCorrect;
      options.forEach((o, i) => { o.is_correct = i === correctIdx; });
      return {
        question_text: q.question_text.trim(),
        explanation: (q.explanation ?? "").trim() || null,
        points: Math.max(1, Math.round(q.points ?? 1)),
        options,
      };
    })
    .filter((q) => q.question_text.length > 0 && q.options.length >= 2);
}

/**
 * Persist questions + options for a quiz.
 * `replace` wipes existing questions first (options cascade).
 * Returns the number of questions written.
 */
export async function saveQuizQuestions(
  quizId: number,
  questions: ReadonlyArray<DraftQuestionInput>,
  mode: SaveMode = "append",
): Promise<number> {
  const clean = normalizeDraftQuestions(questions);
  if (clean.length === 0) throw new Error("Nothing to save — each question needs text and at least 2 options.");

  if (mode === "replace") {
    const { error } = await db.from("quiz_questions").delete().eq("quiz_id", quizId);
    if (error) throw error;
  }

  let startOrder = 0;
  if (mode === "append") {
    const { data } = await db
      .from("quiz_questions")
      .select("sort_order")
      .eq("quiz_id", quizId)
      .order("sort_order", { ascending: false })
      .limit(1);
    startOrder = Number((data ?? [])[0]?.sort_order ?? 0);
  }

  for (let i = 0; i < clean.length; i++) {
    const q = clean[i];
    const { data: row, error: qErr } = await db
      .from("quiz_questions")
      .insert({
        quiz_id: quizId,
        question_text: q.question_text,
        explanation: q.explanation,
        points: q.points,
        sort_order: startOrder + i + 1,
      })
      .select("id")
      .single();
    if (qErr) throw qErr;

    const { error: oErr } = await db.from("quiz_options").insert(
      q.options.map((o, idx) => ({
        question_id: row.id as number,
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: idx + 1,
      })),
    );
    if (oErr) throw oErr;
  }

  return clean.length;
}

/** Create an empty draft quiz for a course and return its id. */
export async function createDraftQuiz(courseId: number, title = "Untitled quiz"): Promise<number> {
  const { data, error } = await db
    .from("quizzes")
    .insert({ course_id: courseId, title, passing_score: 70, status: "draft" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}