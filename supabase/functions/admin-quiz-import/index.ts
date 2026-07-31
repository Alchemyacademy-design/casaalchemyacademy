/* eslint-disable @typescript-eslint/no-explicit-any */
// admin-quiz-import: admin-only. Takes raw quiz text (pasted, or extracted in
// the browser from a .txt/.md/.pdf file) and returns a STRUCTURED DRAFT
// (questions + options + which option is correct + explanation).
//
// Nothing is written to the database — the admin reviews the parsed result in
// the editor and saves it as a draft quiz from the UI.
//
// Security: Bearer JWT required, admin role verified via service-role client.

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

const SYSTEM_PROMPT = `You convert a quiz written by a human (pasted text or text extracted from a PDF) into strict JSON.

Rules:
- Preserve the author's wording. Do NOT invent, rewrite or add questions.
- Keep the ORIGINAL LANGUAGE of the source text for every field.
- Every question must have between 2 and 6 options and EXACTLY ONE option with "is_correct": true.
- If the source marks the correct answer (asterisk, bold, "Answer: B", "Resposta: C", checkbox, highlighted), respect it.
- If the source does not mark a correct answer, choose the option that is factually correct according to the question, and say so in the explanation.
- "explanation" is a short (1-3 sentence) rationale. If the source has one, reuse it.
- Ignore page numbers, headers, footers and other PDF noise.

Respond with valid JSON only, no markdown fences, no commentary.`;

type DraftOption = { option_text: string; is_correct: boolean };
type DraftQuestion = { question_text: string; options: DraftOption[]; explanation: string };
type Draft = { title: string; description: string; questions: DraftQuestion[] };

// deno-lint-ignore no-explicit-any
function coerceDraft(raw: any): Draft {
  if (!raw || typeof raw !== "object") throw new Error("invalid_draft");
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  // deno-lint-ignore no-explicit-any
  const questions: DraftQuestion[] = rawQuestions.slice(0, 60).map((q: any) => {
    const opts = Array.isArray(q?.options) ? q.options : [];
    // deno-lint-ignore no-explicit-any
    const options: DraftOption[] = opts.slice(0, 6).map((o: any) => ({
      option_text: String(o?.option_text ?? o?.text ?? "").trim().slice(0, 500),
      is_correct: Boolean(o?.is_correct),
    })).filter((o: DraftOption) => o.option_text.length > 0);
    return {
      question_text: String(q?.question_text ?? q?.question ?? "").trim().slice(0, 1000),
      options,
      explanation: String(q?.explanation ?? "").trim().slice(0, 800),
    };
  }).filter((q: DraftQuestion) => q.question_text.length > 0 && q.options.length >= 2);

  for (const q of questions) {
    const first = q.options.findIndex((o) => o.is_correct);
    const idx = first === -1 ? 0 : first;
    q.options.forEach((o, i) => { o.is_correct = i === idx; });
  }

  if (questions.length === 0) throw new Error("no_questions_detected");

  return {
    title: String(raw.title ?? "").trim().slice(0, 200),
    description: String(raw.description ?? "").trim().slice(0, 1000),
    questions,
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

  let payload: { raw_text?: string; source_name?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const rawText = String(payload.raw_text ?? "").trim();
  if (rawText.replace(/\s+/g, "").length < 40) return json({ error: "insufficient_text" }, 400);
  const sourceText = rawText.slice(0, 45000);
  const sourceName = String(payload.source_name ?? "").slice(0, 200);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "ai_not_configured" }, 500);

  const userPrompt = `Convert the quiz below into JSON with this exact schema:

{
  "title": string,
  "description": string,
  "questions": [
    {
      "question_text": string,
      "explanation": string,
      "options": [ { "option_text": string, "is_correct": boolean } ]
    }
  ]
}

${sourceName ? `Source file: ${sourceName}\n` : ""}SOURCE QUIZ:
"""
${sourceText}
"""`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[admin-quiz-import] gateway", res.status, body);
      if (res.status === 429) return json({ error: "rate_limited" }, 429);
      if (res.status === 402) return json({ error: "credits_exhausted" }, 402);
      return json({ error: "ai_generation_failed" }, 500);
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = JSON.parse(content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
    }
    return json({ draft: coerceDraft(parsed) });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[admin-quiz-import] failed", msg);
    if (msg === "no_questions_detected") return json({ error: "no_questions_detected" }, 422);
    return json({ error: "ai_generation_failed" }, 500);
  }
});