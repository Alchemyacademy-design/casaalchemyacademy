// submit-quiz-attempt: thin authenticated wrapper around the SECURITY DEFINER
// RPC public.submit_quiz_attempt_transactional. The RPC owns ALL business
// rules — access, max_attempts, payload validation, grading, atomic insert
// of quiz_attempts + quiz_answers under pg_advisory_xact_lock. This function
// only:
//   1. validates the JWT,
//   2. shape-checks the payload,
//   3. forwards user_id + payload to the RPC,
//   4. maps RPC errors to safe public codes, logging details server-side.
//
// is_correct never crosses the network back to the member; the RPC returns
// only { score, passed, attempts_remaining }.

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
  if (!Number.isFinite(quizId) || quizId <= 0) return { ok: false, error: "invalid_quiz_id" };
  if (!Array.isArray(v.answers)) return { ok: false, error: "invalid_answers" };
  const answers: Answer[] = [];
  for (const raw of v.answers) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_answer_entry" };
    const a = raw as Record<string, unknown>;
    const qid = Number(a.question_id);
    const oid = Number(a.option_id);
    if (!Number.isFinite(qid) || !Number.isFinite(oid)) {
      return { ok: false, error: "invalid_answer_ids" };
    }
    answers.push({ question_id: qid, option_id: oid });
  }
  return { ok: true, data: { quiz_id: quizId, answers } };
}

// Map RPC error tokens (raised via RAISE EXCEPTION 'token') to safe codes.
// Anything unrecognised is squashed to a generic submission_failed so we never
// leak SQL state to the browser; details are logged via console.error.
function mapRpcError(message: string): { code: string; status: number } {
  const norm = message.toLowerCase();
  if (norm.includes("quiz_unavailable")) return { code: "quiz_unavailable", status: 404 };
  if (norm.includes("forbidden")) return { code: "forbidden", status: 403 };
  if (norm.includes("no_attempts_remaining")) return { code: "no_attempts_remaining", status: 409 };
  if (norm.includes("admin_preview_blocked")) return { code: "admin_preview_blocked", status: 409 };
  if (norm.includes("invalid_question_ref")) return { code: "invalid_question_ref", status: 400 };
  if (norm.includes("invalid_option_ref")) return { code: "invalid_option_ref", status: 400 };
  if (norm.includes("duplicate_question")) return { code: "duplicate_question", status: 400 };
  if (norm.includes("missing_answer")) return { code: "missing_answer", status: 400 };
  if (norm.includes("extra_answer")) return { code: "extra_answer", status: 400 };
  return { code: "submission_failed", status: 500 };
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

  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data, error } = await admin.rpc("internal_submit_quiz_attempt", {
    p_user_id: userId,
    p_quiz_id: parsed.data.quiz_id,
    p_answers: parsed.data.answers,
  });

  if (error) {
    console.error("[submit-quiz-attempt] rpc error", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    const mapped = mapRpcError(error.message ?? "");
    return json({ error: mapped.code }, mapped.status);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return json({ error: "submission_failed" }, 500);

  return json({
    score: Number(row.score ?? 0),
    passed: !!row.passed,
    attempts_remaining: row.attempts_remaining == null ? null : Number(row.attempts_remaining),
  });
});
