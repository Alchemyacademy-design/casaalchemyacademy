// get-admin-quiz: returns a quiz (any status) including is_correct on options
// so the editor and admin preview can grade locally. Requires admin role.
// Non-admins receive 403 — they must use get-member-quiz.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAdminUser } from "../_shared/quiz-access.ts";

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

  const admin = createClient(SUPABASE_URL, SERVICE);
  if (!(await isAdminUser(admin, userId))) return json({ error: "forbidden" }, 403);

  let payload: { quiz_id?: number } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const quizId = Number(payload.quiz_id);
  if (!Number.isFinite(quizId) || quizId <= 0) return json({ error: "invalid_quiz_id" }, 400);

  const { data: quiz, error: quizErr } = await admin
    .from("quizzes")
    .select("id, course_id, lesson_id, module_id, title, description, passing_score, max_attempts, status")
    .eq("id", quizId)
    .maybeSingle();
  if (quizErr) {
    console.error("[get-admin-quiz] quiz lookup", quizErr.message);
    return json({ error: "quiz_lookup_failed" }, 500);
  }
  if (!quiz) return json({ error: "quiz_not_found" }, 404);

  const { data: questions, error: qErr } = await admin
    .from("quiz_questions")
    .select("id, quiz_id, question_text, points, explanation, sort_order, quiz_options(id, question_id, option_text, is_correct, sort_order)")
    .eq("quiz_id", quizId)
    .order("sort_order");
  if (qErr) {
    console.error("[get-admin-quiz] questions", qErr.message);
    return json({ error: "questions_failed" }, 500);
  }

  const mapped = (questions ?? []).map((q: { quiz_options?: Array<{ sort_order: number }> } & Record<string, unknown>) => ({
    ...q,
    options: (q.quiz_options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
  }));

  return json({ quiz, questions: mapped });
});
