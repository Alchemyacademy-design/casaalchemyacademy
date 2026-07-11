// admin-quiz-assistant: admin-only. Reads real course/module/lesson content
// from the database, calls the Lovable AI Gateway, and returns a structured
// quiz DRAFT (title, description, passing_score, max_attempts, questions[]
// with options + explanation). NOTHING is written to the database — the
// admin reviews/edits in the UI and saves separately with status='draft'.
//
// Security follows the same pattern as get-admin-quiz:
//   - Requires Bearer JWT
//   - Validates admin role via user_roles (service-role client)
//   - 403 for non-admins
// The AI receives ONLY the selected course/module/lesson content — never the
// full database.

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

const BRAND_SYSTEM_PROMPT = `Você escreve conteúdo educacional para a Alchemy Academy, plataforma de educação em design de interiores de Lorena Couto (Casa Alchemy Studio, Sydney).

Tom: sofisticado, direto, confiante, acessível — autoridade sem distância. Frases curtas. Educacional, nunca condescendente.

Nunca use: linguagem genérica de decoração, clichês de design de interiores, linguagem promocional, superlativos vazios ("stunning", "amazing", "incredible", "beautiful"), frases de preenchimento.

Sempre use: linguagem baseada em princípios, framing de transformação (antes/depois), referências à vida real e função, posicionamento de escolha consciente. Nunca promova consumo excessivo, fast furniture ou perseguição de tendências.

O quiz deve testar compreensão real do conteúdo da aula fornecida — nunca inventar teoria que não esteja no material de origem. Perguntas objetivas, com exatamente uma resposta correta, e uma explicação curta e didática para cada uma.

Você DEVE responder exclusivamente em JSON válido, sem texto fora do JSON, exatamente no schema pedido pelo usuário. Escreva no mesmo idioma do conteúdo fornecido (português se o material está em português; inglês se está em inglês).`;

// deno-lint-ignore no-explicit-any
function extractBlockText(block: any): string {
  if (!block) return "";
  const c = block.content;
  if (!c) return "";
  if (typeof c === "string") return c;
  if (typeof c === "object") {
    // common shapes: { text }, { html }, { markdown }, { body }, { value }
    const parts: string[] = [];
    for (const k of ["text", "markdown", "body", "value", "html", "caption"]) {
      if (typeof c[k] === "string") parts.push(c[k]);
    }
    return parts.join("\n").trim();
  }
  return "";
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// deno-lint-ignore no-explicit-any
async function loadContent(admin: any, params: {
  courseId: number; moduleId?: number | null; lessonId?: number | null;
}): Promise<{ scope: string; text: string; courseTitle: string; sourceCounts: { lessons: number; blocks: number } }> {
  const { courseId, moduleId, lessonId } = params;

  const { data: course } = await admin
    .from("courses")
    .select("id,title,subtitle,description,short_description")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) throw new Error("course_not_found");

  // Which lessons to include?
  let lessonQuery = admin
    .from("lessons")
    .select("id,title,description,content_text,module_id,sort_order,course_modules!inner(id,course_id,title,sort_order)")
    .eq("course_modules.course_id", courseId)
    .is("archived_at", null)
    .order("sort_order");

  if (lessonId) lessonQuery = lessonQuery.eq("id", lessonId);
  else if (moduleId) lessonQuery = lessonQuery.eq("module_id", moduleId);

  const { data: lessons, error: lessonsErr } = await lessonQuery;
  if (lessonsErr) throw new Error(`lessons_query_failed:${lessonsErr.message}`);

  const lessonList = (lessons ?? []) as Array<{
    id: number; title: string; description: string | null; content_text: string | null;
    module_id: number; sort_order: number; course_modules: { title: string; sort_order: number };
  }>;
  if (lessonList.length === 0) throw new Error("no_lessons_found");

  const lessonIds = lessonList.map((l) => l.id);
  const { data: blocks } = await admin
    .from("lesson_blocks")
    .select("lesson_id,block_type,content,position,is_visible")
    .in("lesson_id", lessonIds)
    .eq("is_visible", true)
    .order("position");

  const blocksByLesson = new Map<number, Array<{ block_type: string; content: unknown }>>();
  for (const b of (blocks ?? []) as Array<{ lesson_id: number; block_type: string; content: unknown }>) {
    const arr = blocksByLesson.get(b.lesson_id) ?? [];
    arr.push({ block_type: b.block_type, content: b.content });
    blocksByLesson.set(b.lesson_id, arr);
  }

  const parts: string[] = [];
  parts.push(`# Curso: ${course.title}`);
  if (course.subtitle) parts.push(`Subtítulo: ${course.subtitle}`);
  if (course.short_description) parts.push(`Resumo: ${course.short_description}`);
  if (course.description) parts.push(`Descrição: ${stripHtml(course.description)}`);

  let blockCount = 0;
  for (const l of lessonList) {
    parts.push(`\n## Módulo: ${l.course_modules.title} — Aula: ${l.title}`);
    if (l.description) parts.push(`Descrição da aula: ${stripHtml(l.description)}`);
    if (l.content_text) parts.push(stripHtml(l.content_text));
    const bl = blocksByLesson.get(l.id) ?? [];
    for (const b of bl) {
      const text = stripHtml(extractBlockText(b));
      if (text) { parts.push(text); blockCount++; }
    }
  }

  let text = parts.filter(Boolean).join("\n").trim();
  // Hard cap on prompt content to keep costs bounded and reject empty content
  const MAX_CHARS = 24000;
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + "\n…[truncated]";
  if (text.replace(/\s+/g, "").length < 40) throw new Error("insufficient_content");

  const scope = lessonId ? "lesson" : moduleId ? "module" : "course";
  return {
    scope,
    text,
    courseTitle: course.title,
    sourceCounts: { lessons: lessonList.length, blocks: blockCount },
  };
}

type DraftOption = { option_text: string; is_correct: boolean };
type DraftQuestion = { question_text: string; options: DraftOption[]; explanation: string };
type Draft = {
  title: string;
  description: string;
  passing_score: number;
  max_attempts: number;
  questions: DraftQuestion[];
};

function coerceDraft(raw: unknown): Draft {
  // deno-lint-ignore no-explicit-any
  const r = raw as any;
  if (!r || typeof r !== "object") throw new Error("invalid_draft");
  const questions = Array.isArray(r.questions) ? r.questions : [];
  const normQuestions: DraftQuestion[] = questions.slice(0, 20).map((q: any) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const normOpts: DraftOption[] = opts.slice(0, 6).map((o: any) => ({
      option_text: String(o?.option_text ?? o?.text ?? "").trim(),
      is_correct: Boolean(o?.is_correct),
    })).filter((o) => o.option_text.length > 0);
    return {
      question_text: String(q?.question_text ?? q?.question ?? "").trim(),
      options: normOpts,
      explanation: String(q?.explanation ?? "").trim(),
    };
  }).filter((q) => q.question_text.length > 0 && q.options.length >= 2);

  // Guarantee exactly one correct per question — if none marked, mark first;
  // if multiple, keep only the first true.
  for (const q of normQuestions) {
    const firstTrue = q.options.findIndex((o) => o.is_correct);
    if (firstTrue === -1) q.options[0].is_correct = true;
    q.options.forEach((o, i) => { o.is_correct = i === (firstTrue === -1 ? 0 : firstTrue); });
  }

  const passing = Number(r.passing_score);
  const attempts = Number(r.max_attempts);
  return {
    title: String(r.title ?? "Untitled quiz").trim().slice(0, 200) || "Untitled quiz",
    description: String(r.description ?? "").trim().slice(0, 1000),
    passing_score: Number.isFinite(passing) && passing >= 0 && passing <= 100 ? Math.round(passing) : 70,
    max_attempts: Number.isFinite(attempts) && attempts >= 1 && attempts <= 20 ? Math.round(attempts) : 3,
    questions: normQuestions,
  };
}

async function callAi(sourceText: string, instructions: string, courseTitle: string, questionCount: number): Promise<Draft> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("missing_lovable_api_key");

  const userPrompt = `Você receberá o conteúdo real de uma aula/módulo do curso "${courseTitle}" e deve gerar um RASCUNHO de quiz baseado ESTRITAMENTE nesse conteúdo.

Regras obrigatórias:
- Gere ${questionCount} perguntas objetivas de múltipla escolha.
- Cada pergunta tem EXATAMENTE 4 opções e EXATAMENTE 1 opção correta.
- Cada pergunta tem uma explicação curta (1–3 frases) que ensina o porquê da resposta correta.
- As perguntas devem testar compreensão do material fornecido — proibido inventar fatos, teorias ou nomes que não estejam no texto.
- Sugira passing_score (0–100) e max_attempts (1–5) coerentes com a dificuldade.

${instructions ? `Instruções adicionais do administrador: ${instructions}\n\n` : ""}Responda EXCLUSIVAMENTE em JSON válido no seguinte schema (sem markdown, sem comentário, sem texto fora do JSON):

{
  "title": string,
  "description": string,
  "passing_score": number,
  "max_attempts": number,
  "questions": [
    {
      "question_text": string,
      "explanation": string,
      "options": [
        { "option_text": string, "is_correct": boolean },
        { "option_text": string, "is_correct": boolean },
        { "option_text": string, "is_correct": boolean },
        { "option_text": string, "is_correct": boolean }
      ]
    }
  ]
}

CONTEÚDO DA AULA/MÓDULO (fonte da verdade — não invente nada fora disto):
"""
${sourceText}
"""`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: BRAND_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    console.error("[admin-quiz-assistant] AI gateway error", res.status, bodyText);
    if (res.status === 429) throw new Error("ai_rate_limited");
    if (res.status === 402) throw new Error("ai_credits_exhausted");
    throw new Error(`ai_gateway_error_${res.status}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Attempt to strip code fences if any
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  }
  return coerceDraft(parsed);
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

  let payload: {
    course_id?: number; module_id?: number | null; lesson_id?: number | null;
    instructions?: string; question_count?: number;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const courseId = Number(payload.course_id);
  if (!Number.isFinite(courseId) || courseId <= 0) return json({ error: "invalid_course_id" }, 400);
  const moduleId = payload.module_id ? Number(payload.module_id) : null;
  const lessonId = payload.lesson_id ? Number(payload.lesson_id) : null;
  const instructions = String(payload.instructions ?? "").slice(0, 800);
  const qc = Number(payload.question_count);
  const questionCount = Number.isFinite(qc) && qc >= 3 && qc <= 15 ? Math.round(qc) : 8;

  let content;
  try {
    content = await loadContent(admin, { courseId, moduleId, lessonId });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "course_not_found") return json({ error: "course_not_found" }, 404);
    if (msg === "no_lessons_found") return json({ error: "no_lessons_found" }, 404);
    if (msg === "insufficient_content") return json({ error: "insufficient_content" }, 400);
    console.error("[admin-quiz-assistant] loadContent", msg);
    return json({ error: "content_load_failed" }, 500);
  }

  try {
    const draft = await callAi(content.text, instructions, content.courseTitle, questionCount);
    return json({
      draft,
      scope: content.scope,
      source_counts: content.sourceCounts,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[admin-quiz-assistant] AI error", msg);
    if (msg === "ai_rate_limited") return json({ error: "rate_limited" }, 429);
    if (msg === "ai_credits_exhausted") return json({ error: "credits_exhausted" }, 402);
    if (msg === "missing_lovable_api_key") return json({ error: "ai_not_configured" }, 500);
    return json({ error: "ai_generation_failed", detail: msg }, 500);
  }
});
