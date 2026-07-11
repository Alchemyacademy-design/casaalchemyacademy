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

LANGUAGE DETECTION (CRITICAL): Detect the dominant language of the SOURCE course/module/lesson content provided by the user (the text pulled from the database — course description, lesson descriptions, lesson content, lesson blocks). Write your ENTIRE output — title, description, every question_text, every option_text (including true/false labels), and every explanation — in that same detected language. Do NOT default to English or any fixed language. If the source is in Portuguese, the whole quiz is in Portuguese (and true/false options are "Verdadeiro"/"Falso"). If it's in English, the whole quiz is in English ("True"/"False"). If it's in Spanish, everything in Spanish ("Verdadero"/"Falso"), and so on. The administrator's extra instructions and any pasted extra context may be written in a different language purely as guidance — IGNORE that language signal for output; the output language is determined ONLY by the dominant language of the actual source lesson/module material from the database. Never mix languages inside a single quiz.

Você DEVE responder exclusivamente em JSON válido, sem texto fora do JSON, exatamente no schema pedido pelo usuário.`;

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
  courseId: number; moduleId?: number | null; lessonId?: number | null; extraContext?: string;
}): Promise<{ scope: string; text: string; courseTitle: string; sourceCounts: { lessons: number; blocks: number } }> {
  const { courseId, moduleId, lessonId, extraContext } = params;

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
  // Hard cap on DB content
  const MAX_DB = 28000;
  if (text.length > MAX_DB) text = text.slice(0, MAX_DB) + "\n…[truncated]";

  const extra = (extraContext ?? "").trim();
  if (extra.length > 0) {
    const MAX_EXTRA = 20000;
    const trimmedExtra = extra.length > MAX_EXTRA ? extra.slice(0, MAX_EXTRA) + "\n…[truncated]" : extra;
    text += `\n\n## MATERIAL ADICIONAL FORNECIDO PELO ADMINISTRADOR (transcrição/contexto — trate como fonte de verdade adicional, somando ao conteúdo acima):\n${trimmedExtra}`;
  }

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

async function callAi(
  sourceText: string,
  instructions: string,
  courseTitle: string,
  questionCount: number,
  quizType: "lesson" | "module" | "final",
  questionFormat: "mcq" | "mixed",
): Promise<Draft> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("missing_lovable_api_key");

  const typeLabel =
    quizType === "final" ? "EXAME FINAL cumulativo do curso inteiro"
    : quizType === "module" ? "quiz de módulo"
    : "quiz de aula";

  const typeGuidance =
    quizType === "final"
      ? `Este é um EXAME FINAL cumulativo — deve cobrir os principais conceitos de TODOS os módulos do curso de forma equilibrada (proibido concentrar tudo no último módulo). Rigor maior nas perguntas, exigindo síntese entre módulos quando possível. Inclua "— Final Exam" no título sugerido.`
      : quizType === "module"
      ? `Este é um quiz de módulo — cubra os principais pontos do módulo de forma equilibrada entre as aulas.`
      : `Este é um quiz de aula específica — foque no conteúdo dessa aula.`;

  const formatRule = questionFormat === "mixed"
    ? `Formato MISTO: use múltipla escolha (4 opções) para a maioria e, quando fizer sentido, algumas perguntas verdadeiro/falso com EXATAMENTE 2 opções. Os rótulos das opções de verdadeiro/falso DEVEM estar no mesmo idioma detectado do conteúdo de origem (ex.: "Verdadeiro"/"Falso" em português, "True"/"False" em inglês, "Verdadero"/"Falso" em espanhol). Toda pergunta tem exatamente 1 opção correta.`
    : `Formato: múltipla escolha somente. Cada pergunta tem EXATAMENTE 4 opções e EXATAMENTE 1 opção correta.`;

  const userPrompt = `Você receberá o conteúdo real do curso "${courseTitle}" e deve gerar um RASCUNHO de ${typeLabel} baseado ESTRITAMENTE nesse conteúdo.

${typeGuidance}

Regras obrigatórias:
- IDIOMA: detecte o idioma predominante do CONTEÚDO DO CURSO abaixo (a fonte de verdade vinda do banco) e escreva TODO o output (título, descrição, perguntas, opções, explicações) nesse mesmo idioma. Não use inglês por padrão. Instruções do administrador podem estar em outro idioma apenas como orientação — NÃO deixe isso influenciar o idioma de saída.
- Gere ${questionCount} perguntas objetivas.
- ${formatRule}
- Cada pergunta tem uma explicação curta (1–3 frases) que ensina o porquê da resposta correta.
- As perguntas devem testar compreensão do material fornecido — proibido inventar fatos, teorias ou nomes que não estejam no texto.
- Sugira passing_score (0–100) e max_attempts (1–5) coerentes com a dificuldade e o tipo de quiz.

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
        { "option_text": string, "is_correct": boolean }
      ]
    }
  ]
}

CONTEÚDO DO CURSO (fonte da verdade — não invente nada fora disto):
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
    extra_context?: string; quiz_type?: string; question_format?: string;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const courseId = Number(payload.course_id);
  if (!Number.isFinite(courseId) || courseId <= 0) return json({ error: "invalid_course_id" }, 400);
  const quizType: "lesson" | "module" | "final" =
    payload.quiz_type === "lesson" || payload.quiz_type === "module" || payload.quiz_type === "final"
      ? payload.quiz_type : "lesson";
  const questionFormat: "mcq" | "mixed" =
    payload.question_format === "mixed" ? "mixed" : "mcq";

  // Enforce scoping according to quiz_type (ignore accidental extra ids).
  const moduleId = quizType === "lesson" || quizType === "module"
    ? (payload.module_id ? Number(payload.module_id) : null)
    : null;
  const lessonId = quizType === "lesson"
    ? (payload.lesson_id ? Number(payload.lesson_id) : null)
    : null;

  const instructions = String(payload.instructions ?? "").slice(0, 800);
  const extraContext = String(payload.extra_context ?? "");
  const qc = Number(payload.question_count);
  const questionCount = Number.isFinite(qc) && qc >= 3 && qc <= 20 ? Math.round(qc) : 8;

  let content;
  try {
    content = await loadContent(admin, { courseId, moduleId, lessonId, extraContext });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "course_not_found") return json({ error: "course_not_found" }, 404);
    if (msg === "no_lessons_found") return json({ error: "no_lessons_found" }, 404);
    if (msg === "insufficient_content") return json({ error: "insufficient_content" }, 400);
    console.error("[admin-quiz-assistant] loadContent", msg);
    return json({ error: "content_load_failed" }, 500);
  }

  try {
    const draft = await callAi(content.text, instructions, content.courseTitle, questionCount, quizType, questionFormat);
    return json({
      draft,
      scope: content.scope,
      source_counts: content.sourceCounts,
      quiz_type: quizType,
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
