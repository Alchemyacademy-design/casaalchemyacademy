/**
 * Quiz domain helpers.
 *
 * The frontend never trusts itself for grading: the score is recomputed from
 * the rows we read back from the DB (or, in admin Preview Mode, from the local
 * "correct option" map the editor already had). The DB schema is:
 *   quizzes(id, course_id, lesson_id?, passing_score, max_attempts, status)
 *   quiz_questions(id, quiz_id, points, sort_order, explanation)
 *   quiz_options(id, question_id, is_correct, sort_order)
 *   quiz_attempts(id, user_id, quiz_id, score, passed, submitted_at)
 *   quiz_answers(attempt_id, question_id, option_id, is_correct, points_awarded)
 *
 * Member rows are filtered by RLS — these helpers exist only to keep page code
 * defensive and to encode the scoring rules in one tested place.
 */

import { supabase } from "@/integrations/supabase/client";

export type QuizStatus = "draft" | "published" | "archived";

export type QuizRow = {
  id: number;
  course_id: number;
  lesson_id: number | null;
  title: string;
  description: string | null;
  passing_score: number; // 0..100
  max_attempts: number | null;
  status: QuizStatus;
};

export type QuestionRow = {
  id: number;
  quiz_id: number;
  question_text: string;
  points: number;
  explanation: string | null;
  sort_order: number;
};

export type OptionRow = {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
};

export type AttemptRow = {
  id: number;
  user_id: string;
  quiz_id: number;
  score: number | null;
  passed: boolean;
  submitted_at: string | null;
};

/** Member-safe option: never carries is_correct outside of admin preview. */
export type MemberOption = Pick<OptionRow, "id" | "question_id" | "option_text" | "sort_order">;
export type MemberQuestion = QuestionRow & { options: MemberOption[] };
export type AdminQuestion = QuestionRow & { options: OptionRow[] };

export type SelectionMap = Record<number, number | null>; // questionId -> optionId

export type GradedResult = {
  score: number;          // 0..100
  totalPoints: number;
  earnedPoints: number;
  passed: boolean;
  perQuestion: Array<{
    questionId: number;
    selectedOptionId: number | null;
    correctOptionId: number | null;
    isCorrect: boolean;
    pointsAwarded: number;
  }>;
};

/** Pure scoring: ratio of earned points to total, scaled 0..100. */
export function gradeAttempt(
  questions: ReadonlyArray<AdminQuestion>,
  selections: SelectionMap,
  passingScore: number,
): GradedResult {
  let totalPoints = 0;
  let earnedPoints = 0;
  const perQuestion = questions.map((q) => {
    const points = Math.max(0, q.points ?? 1);
    totalPoints += points;
    const correct = q.options.find((o) => o.is_correct) ?? null;
    const selected = selections[q.id] ?? null;
    const isCorrect = correct != null && selected === correct.id;
    const pointsAwarded = isCorrect ? points : 0;
    earnedPoints += pointsAwarded;
    return {
      questionId: q.id,
      selectedOptionId: selected,
      correctOptionId: correct?.id ?? null,
      isCorrect,
      pointsAwarded,
    };
  });
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = totalPoints > 0 && score >= passingScore;
  return { score, totalPoints, earnedPoints, passed, perQuestion };
}

/** Editor integrity: a question is publishable when it has ≥2 options and exactly one is correct. */
export function isQuestionPublishable(options: ReadonlyArray<{ is_correct: boolean }>): boolean {
  if (options.length < 2) return false;
  return options.filter((o) => o.is_correct).length === 1;
}

export function isQuizPublishable(
  quiz: Pick<QuizRow, "title" | "passing_score">,
  questions: ReadonlyArray<{ options: ReadonlyArray<{ is_correct: boolean }> }>,
): boolean {
  if (!quiz.title?.trim()) return false;
  if (quiz.passing_score < 0 || quiz.passing_score > 100) return false;
  if (questions.length === 0) return false;
  return questions.every((q) => isQuestionPublishable(q.options));
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

// PostgREST string-name access; widen the typed facade.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

/** Member load: fetches quiz + questions + options WITHOUT is_correct. */
export async function loadMemberQuiz(quizId: number): Promise<{
  quiz: QuizRow;
  questions: MemberQuestion[];
} | null> {
  const { data: quiz, error } = await db
    .from("quizzes")
    .select("id,course_id,lesson_id,title,description,passing_score,max_attempts,status")
    .eq("id", quizId)
    .maybeSingle();
  if (error) throw error;
  if (!quiz || quiz.status !== "published") return null;
  const { data: questions, error: qErr } = await db
    .from("quiz_questions")
    .select("id,quiz_id,question_text,points,explanation,sort_order,quiz_options(id,question_id,option_text,sort_order)")
    .eq("quiz_id", quizId)
    .order("sort_order");
  if (qErr) throw qErr;
  return {
    quiz: quiz as QuizRow,
    questions: ((questions ?? []) as Array<QuestionRow & { quiz_options: MemberOption[] }>).map((q) => ({
      ...q,
      options: (q.quiz_options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    })),
  };
}

/** Admin load: includes is_correct so the editor and preview-grading can use it. */
export async function loadAdminQuiz(quizId: number): Promise<{
  quiz: QuizRow;
  questions: AdminQuestion[];
} | null> {
  const { data: quiz, error } = await db
    .from("quizzes")
    .select("id,course_id,lesson_id,title,description,passing_score,max_attempts,status")
    .eq("id", quizId)
    .maybeSingle();
  if (error) throw error;
  if (!quiz) return null;
  const { data: questions, error: qErr } = await db
    .from("quiz_questions")
    .select("id,quiz_id,question_text,points,explanation,sort_order,quiz_options(id,question_id,option_text,is_correct,sort_order)")
    .eq("quiz_id", quizId)
    .order("sort_order");
  if (qErr) throw qErr;
  return {
    quiz: quiz as QuizRow,
    questions: ((questions ?? []) as Array<QuestionRow & { quiz_options: OptionRow[] }>).map((q) => ({
      ...q,
      options: (q.quiz_options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    })),
  };
}

export async function listAttempts(quizId: number): Promise<AttemptRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from("quiz_attempts")
    .select("id,user_id,quiz_id,score,passed,submitted_at")
    .eq("user_id", user.id)
    .eq("quiz_id", quizId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AttemptRow[];
}

/**
 * Submit a member attempt — authoritative grading runs in the
 * `submit-quiz-attempt` edge function. The browser never reads
 * `quiz_options.is_correct` for members; it only forwards the user's selections
 * to the server, which validates access, applies max_attempts, grades, and
 * persists the attempt.
 *
 * Returns the minimum surface the UI needs: { score, passed, attemptsRemaining }.
 */
export type SubmitResult = {
  score: number;
  passed: boolean;
  attemptsRemaining: number | null;
};

export async function submitAttempt(quizId: number, selections: SelectionMap): Promise<SubmitResult> {
  const answers = Object.entries(selections)
    .filter(([, optionId]) => optionId != null)
    .map(([qid, optionId]) => ({
      question_id: Number(qid),
      option_id: Number(optionId),
    }));

  const { data, error } = await supabase.functions.invoke<{
    score: number;
    passed: boolean;
    attempts_remaining: number | null;
    error?: string;
    message?: string;
  }>("submit-quiz-attempt", {
    body: { quiz_id: quizId, answers },
  });

  if (error) {
    // The Supabase JS client wraps non-2xx as FunctionsHttpError; surface a
    // user-readable message without exposing internals.
    const message = (error as { message?: string }).message ?? "Quiz submission failed";
    throw new Error(message);
  }
  if (!data) throw new Error("Quiz submission failed");
  if (data.error) {
    const map: Record<string, string> = {
      quiz_unavailable: "This quiz is no longer available.",
      forbidden: "You do not have access to this quiz.",
      no_attempts_remaining: "You have no attempts remaining.",
      invalid_question_ref: "One of the answers is invalid. Please reload and try again.",
      invalid_option_ref: "One of the answers is invalid. Please reload and try again.",
    };
    throw new Error(map[data.error] ?? data.message ?? data.error);
  }
  return {
    score: data.score,
    passed: data.passed,
    attemptsRemaining: data.attempts_remaining,
  };
}

/** Did the user pass any published required quiz for this course? */
export async function passedQuizIdsForCourse(courseId: number): Promise<Set<number>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data: quizzes } = await db
    .from("quizzes")
    .select("id")
    .eq("course_id", courseId)
    .eq("status", "published");
  const ids = ((quizzes ?? []) as Array<{ id: number }>).map((q) => q.id);
  if (!ids.length) return new Set();
  const { data: attempts } = await db
    .from("quiz_attempts")
    .select("quiz_id,passed,submitted_at")
    .eq("user_id", user.id)
    .in("quiz_id", ids)
    .not("submitted_at", "is", null)
    .eq("passed", true);
  return new Set(((attempts ?? []) as Array<{ quiz_id: number }>).map((a) => a.quiz_id));
}

export async function listPublishedQuizzesForCourse(courseId: number): Promise<QuizRow[]> {
  const { data, error } = await db
    .from("quizzes")
    .select("id,course_id,lesson_id,title,description,passing_score,max_attempts,status")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("id");
  if (error) throw error;
  return (data ?? []) as QuizRow[];
}
