// submit-quiz-attempt: server-side, authoritative quiz grading.
//
// Why this exists: the previous client-only path read quiz_options.is_correct
// from the browser to compute a score. Any authenticated user could query
// PostgREST and read the answer key before submitting. This function is the
// single trusted grader: it validates access, grades using server-only reads
// of is_correct, enforces max_attempts, persists quiz_attempts + quiz_answers,
// and returns only { score, passed, attempts_remaining }. is_correct never
// crosses the network back to the member.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Answer = { question_id: number; option_id: number };
type Body = { quiz_id: number; answers: Answer[] };

function parseBody(value: unknown): { ok: true; data: Body } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "invalid body" };
  const v = value as Record<string, unknown>;
  const quizId = Number(v.quiz_id);
  if (!Number.isFinite(quizId) || quizId <= 0) return { ok: false, error: "invalid quiz_id" };
  if (!Array.isArray(v.answers)) return { ok: false, error: "invalid answers" };
  const answers: Answer[] = [];
  for (const raw of v.answers) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "invalid answer entry" };
    const a = raw as Record<string, unknown>;
    const qid = Number(a.question_id);
    const oid = Number(a.option_id);
    if (!Number.isFinite(qid) || !Number.isFinite(oid)) {
      return { ok: false, error: "invalid answer ids" };
    }
    answers.push({ question_id: qid, option_id: oid });
  }
  return { ok: true, data: { quiz_id: quizId, answers } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = parseBody(payload);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { quiz_id, answers } = parsed.data;

  const admin = createClient(SUPABASE_URL, SERVICE);

  // 1) Quiz must be published.
  const { data: quiz, error: quizErr } = await admin
    .from("quizzes")
    .select("id, course_id, status, passing_score, max_attempts")
    .eq("id", quiz_id)
    .maybeSingle();
  if (quizErr) return json({ error: "quiz_lookup_failed", message: quizErr.message }, 500);
  if (!quiz || quiz.status !== "published") return json({ error: "quiz_unavailable" }, 404);

  // 2) Access: admin OR active membership OR active entitlement for course_id.
  const nowIso = new Date().toISOString();
  const [rolesRes, membershipRes, entRes] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin"),
    admin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("ends_at", nowIso)
      .limit(1),
    admin
      .from("course_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", quiz.course_id)
      .eq("active", true)
      .gt("ends_at", nowIso)
      .limit(1),
  ]);
  const isAdmin = (rolesRes.data ?? []).length > 0;
  const hasAccess =
    isAdmin || (membershipRes.data ?? []).length > 0 || (entRes.data ?? []).length > 0;
  if (!hasAccess) return json({ error: "forbidden" }, 403);

  // 3) Server-side answer key.
  const { data: questions, error: qErr } = await admin
    .from("quiz_questions")
    .select("id, points, quiz_options(id, is_correct)")
    .eq("quiz_id", quiz_id);
  if (qErr) return json({ error: "questions_failed", message: qErr.message }, 500);

  const questionIds = new Set((questions ?? []).map((q: { id: number }) => Number(q.id)));
  const optionIndex = new Map<number, { questionId: number; isCorrect: boolean }>();
  for (const q of (questions ?? []) as Array<{
    id: number;
    points: number | null;
    quiz_options: Array<{ id: number; is_correct: boolean }>;
  }>) {
    for (const o of q.quiz_options ?? []) {
      optionIndex.set(Number(o.id), { questionId: Number(q.id), isCorrect: !!o.is_correct });
    }
  }

  for (const a of answers) {
    if (!questionIds.has(a.question_id)) return json({ error: "invalid_question_ref" }, 400);
    const opt = optionIndex.get(a.option_id);
    if (!opt || opt.questionId !== a.question_id) return json({ error: "invalid_option_ref" }, 400);
  }

  // 4) Enforce max_attempts (admins exempt for preview convenience but we still
  // refuse to insert below — admin preview should not call this endpoint).
  const { data: priorAttempts, error: attErr } = await admin
    .from("quiz_attempts")
    .select("id, submitted_at")
    .eq("user_id", userId)
    .eq("quiz_id", quiz_id);
  if (attErr) return json({ error: "attempts_lookup_failed", message: attErr.message }, 500);
  const submittedCount = (priorAttempts ?? []).filter((a: { submitted_at: string | null }) => a.submitted_at != null).length;
  if (quiz.max_attempts != null && submittedCount >= quiz.max_attempts && !isAdmin) {
    return json({ error: "no_attempts_remaining" }, 409);
  }

  // 5) Grade.
  let totalPoints = 0;
  let earnedPoints = 0;
  const answerRows: Array<{
    question_id: number;
    option_id: number;
    is_correct: boolean;
    points_awarded: number;
  }> = [];
  const answeredBy = new Map<number, Answer>();
  for (const a of answers) answeredBy.set(a.question_id, a);
  for (const q of (questions ?? []) as Array<{ id: number; points: number | null }>) {
    const points = Math.max(0, q.points ?? 1);
    totalPoints += points;
    const a = answeredBy.get(Number(q.id));
    if (!a) continue;
    const opt = optionIndex.get(a.option_id)!;
    const awarded = opt.isCorrect ? points : 0;
    earnedPoints += awarded;
    answerRows.push({
      question_id: Number(q.id),
      option_id: a.option_id,
      is_correct: opt.isCorrect,
      points_awarded: awarded,
    });
  }
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = totalPoints > 0 && score >= (quiz.passing_score ?? 0);

  // 6) Persist.
  const { data: attempt, error: insErr } = await admin
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      quiz_id: quiz_id,
      score,
      passed,
      started_at: nowIso,
      submitted_at: nowIso,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: "attempt_insert_failed", message: insErr.message }, 500);

  if (answerRows.length) {
    const { error: ansErr } = await admin
      .from("quiz_answers")
      .insert(answerRows.map((r) => ({ ...r, attempt_id: attempt.id })));
    if (ansErr) return json({ error: "answers_insert_failed", message: ansErr.message }, 500);
  }

  const attemptsRemaining =
    quiz.max_attempts != null ? Math.max(0, quiz.max_attempts - (submittedCount + 1)) : null;

  return json({ score, passed, attempts_remaining: attemptsRemaining });
});
