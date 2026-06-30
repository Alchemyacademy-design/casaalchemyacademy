// seed-pilot-quizzes: idempotent admin-only seeder for the 10-module
// pilot quiz bank. Maps each entry in ./bank.ts to its course (by slug),
// and recreates the quiz keyed by (course_id, quiz_title).
//
// POST body (all optional):
//   { course_slug?: string }  — restrict to a single course
//   { dry_run?: boolean }     — preview only, no writes
// Returns a per-course summary. Admin auth required.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAdminUser } from "../_shared/quiz-access.ts";
import { PILOT_QUIZZES, type SeedQuiz } from "./bank.ts";

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

// deno-lint-ignore no-explicit-any
async function seedOne(admin: any, item: SeedQuiz, dryRun: boolean) {
  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id, title, slug")
    .eq("slug", item.course_slug)
    .maybeSingle();
  if (courseErr) return { slug: item.course_slug, ok: false, reason: courseErr.message };
  if (!course) return { slug: item.course_slug, ok: false, reason: "course_not_found" };

  // Find existing quiz with the same idempotency key (course_id + title)
  const { data: existing } = await admin
    .from("quizzes")
    .select("id")
    .eq("course_id", course.id)
    .eq("title", item.quiz_title)
    .maybeSingle();

  if (dryRun) {
    return {
      slug: item.course_slug,
      course_id: course.id,
      ok: true,
      would: existing ? "replace" : "create",
      questions: item.questions.length,
    };
  }

  if (existing?.id) {
    // Delete child rows first to avoid FK errors regardless of cascade config.
    const { data: oldQs } = await admin
      .from("quiz_questions")
      .select("id")
      .eq("quiz_id", existing.id);
    const oldIds = (oldQs ?? []).map((r: { id: number }) => r.id);
    if (oldIds.length) {
      await admin.from("quiz_options").delete().in("question_id", oldIds);
      await admin.from("quiz_questions").delete().in("id", oldIds);
    }
    await admin.from("quizzes").delete().eq("id", existing.id);
  }

  const { data: quizRow, error: qErr } = await admin
    .from("quizzes")
    .insert({
      course_id: course.id,
      title: item.quiz_title,
      description: item.description,
      passing_score: item.passing_score,
      max_attempts: item.max_attempts,
      status: "published",
    })
    .select("id")
    .single();
  if (qErr) return { slug: item.course_slug, ok: false, reason: `quiz_insert: ${qErr.message}` };

  // Insert questions and options sequentially so we can capture IDs.
  for (let i = 0; i < item.questions.length; i++) {
    const q = item.questions[i];
    const { data: qRow, error: insQErr } = await admin
      .from("quiz_questions")
      .insert({
        quiz_id: quizRow.id,
        question_text: q.question,
        points: 1,
        explanation: q.explanation,
        sort_order: i + 1,
      })
      .select("id")
      .single();
    if (insQErr) {
      return { slug: item.course_slug, ok: false, reason: `question_insert: ${insQErr.message}` };
    }
    const optionRows = q.options.map((o, oi) => ({
      question_id: qRow.id,
      option_text: o.text,
      is_correct: o.correct,
      sort_order: oi + 1,
    }));
    const { error: insOErr } = await admin.from("quiz_options").insert(optionRows);
    if (insOErr) return { slug: item.course_slug, ok: false, reason: `option_insert: ${insOErr.message}` };
  }

  return {
    slug: item.course_slug,
    course_id: course.id,
    quiz_id: quizRow.id,
    ok: true,
    action: existing ? "replaced" : "created",
    questions: item.questions.length,
  };
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

  const admin = createClient(SUPABASE_URL, SERVICE);
  if (!(await isAdminUser(admin, userData.user.id))) return json({ error: "forbidden" }, 403);

  let body: { course_slug?: string; dry_run?: boolean } = {};
  try {
    if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
      body = await req.json();
    }
  } catch {
    /* empty body is fine */
  }

  const targets = body.course_slug
    ? PILOT_QUIZZES.filter((q) => q.course_slug === body.course_slug)
    : PILOT_QUIZZES;

  if (!targets.length) {
    return json({ error: "no_matching_slug", course_slug: body.course_slug ?? null }, 404);
  }

  const results = [];
  for (const item of targets) {
    results.push(await seedOne(admin, item, body.dry_run === true));
  }

  const ok = results.every((r) => r.ok);
  return json({
    ok,
    dry_run: body.dry_run === true,
    total: results.length,
    results,
  });
});
