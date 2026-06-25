// get-member-quiz: returns a published quiz with questions and member-safe
// options (no is_correct). Validates JWT and course access server-side, then
// reads through service-role so the browser never touches quiz_options
// directly — even if PostgREST grants were to drift, members still cannot see
// the answer key.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { evaluateCourseAccess } from "../_shared/quiz-access.ts";

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

  let payload: { quiz_id?: number } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const quizId = Number(payload.quiz_id);
  if (!Number.isFinite(quizId) || quizId <= 0) return json({ error: "invalid_quiz_id" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data: quiz, error: quizErr } = await admin
    .from("quizzes")
    .select("id, course_id, lesson_id, title, description, passing_score, max_attempts, status")
    .eq("id", quizId)
    .maybeSingle();
  if (quizErr) {
    console.error("[get-member-quiz] quiz lookup", quizErr.message);
    return json({ error: "quiz_lookup_failed" }, 500);
  }
  if (!quiz || quiz.status !== "published") return json({ error: "quiz_unavailable" }, 404);

  const decision = await evaluateCourseAccess(admin, userId, Number(quiz.course_id));
  if (!decision.allowed) return json({ error: "forbidden" }, 403);

  const { data: questions, error: qErr } = await admin
    .from("quiz_questions")
    .select("id, quiz_id, question_text, points, explanation, sort_order, quiz_options(id, question_id, option_text, sort_order)")
    .eq("quiz_id", quizId)
    .order("sort_order");
  if (qErr) {
    console.error("[get-member-quiz] questions", qErr.message);
    return json({ error: "questions_failed" }, 500);
  }

  const mapped = (questions ?? []).map((q: { quiz_options?: Array<{ sort_order: number }> } & Record<string, unknown>) => ({
    ...q,
    options: (q.quiz_options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
  }));

  return json({ quiz, questions: mapped });
});
