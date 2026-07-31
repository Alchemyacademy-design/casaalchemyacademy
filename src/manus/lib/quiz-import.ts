/**
 * Quiz import: turn a plain-text / PDF quiz written by an admin into the
 * structured shape the editor understands.
 *
 * The parser is deliberately deterministic and forgiving: admins paste quizzes
 * in many shapes. When it cannot recognise enough structure, the caller falls
 * back to the `admin-quiz-import` edge function (AI structuring).
 *
 * Recognised shapes
 * -----------------
 *   1. What is the 60-30-10 rule?          |  Q1) ...   |  1 - ...
 *   a) Sixty percent dominant colour       |  A. ...    |  - ...  |  * ...
 *   *b) ...            <- leading * marks the correct option
 *   b) ... (correct)   <- inline marker, any language variant below
 *   [x] ...            <- checkbox marker
 *   Answer: B          <- answer line (also Resposta/Correta/Gabarito)
 *   Explanation: ...   <- optional (also Explicação/Justificativa)
 */

export type ParsedOption = { option_text: string; is_correct: boolean };
export type ParsedQuestion = {
  question_text: string;
  explanation: string;
  options: ParsedOption[];
};
export type ParsedQuiz = {
  title: string;
  questions: ParsedQuestion[];
};

const QUESTION_RE = /^(?:qu?e?st(?:ion|ão|ao)?\s*)?(\d{1,3})\s*[.)\-:]\s+(.*)$/i;
const OPTION_RE = /^\s{0,6}(?:([*✓✔])\s*)?\(?([a-hA-H])\)?\s*[.)\-:]\s+(.*)$/;
const BULLET_RE = /^\s{0,6}(?:([*✓✔])\s*)?[-•]\s+(.*)$/;
const CHECKBOX_RE = /^\s{0,6}\[([ xX])\]\s*(.*)$/;
const ANSWER_RE =
  /^\s*(?:answer|correct(?:\s*answer)?|resposta(?:\s*correta)?|correta|gabarito|respuesta)\s*[:\-]\s*(.+)$/i;
const EXPLANATION_RE =
  /^\s*(?:explanation|rationale|why|explica[çc][ãa]o|justificativa|explicaci[óo]n)\s*[:\-]\s*(.+)$/i;
const TITLE_RE = /^\s*(?:title|t[íi]tulo)\s*[:\-]\s*(.+)$/i;
const INLINE_CORRECT_RE =
  /\s*[([{]?\s*(?:correct(?:\s*answer)?|correta?|resposta\s*correta|right|verdadeira?)\s*[)\]}]?\s*$/i;

function cleanOption(raw: string): { text: string; correct: boolean } {
  let text = raw.trim();
  let correct = false;
  if (INLINE_CORRECT_RE.test(text)) {
    correct = true;
    text = text.replace(INLINE_CORRECT_RE, "").trim();
  }
  // trailing markers
  if (/[✓✔]\s*$/.test(text)) {
    correct = true;
    text = text.replace(/[✓✔]\s*$/, "").trim();
  }
  text = text.replace(/[\s.;,]+$/, "").trim();
  return { text, correct };
}

const LETTERS = "abcdefgh";

/** Resolve an "Answer: B" / "Resposta: Sixty percent" line to an option index. */
function resolveAnswer(answer: string, options: ParsedOption[]): number {
  const a = answer.trim().replace(/[.)\]]+$/, "").trim();
  if (a.length === 1) {
    const idx = LETTERS.indexOf(a.toLowerCase());
    if (idx >= 0 && idx < options.length) return idx;
  }
  const numeric = Number(a);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= options.length) return numeric - 1;
  const lower = a.toLowerCase();
  const exact = options.findIndex((o) => o.option_text.toLowerCase() === lower);
  if (exact >= 0) return exact;
  const partial = options.findIndex(
    (o) => o.option_text.toLowerCase().includes(lower) || lower.includes(o.option_text.toLowerCase()),
  );
  return partial;
}

/** Parse free-form quiz text. Never throws — returns whatever it recognised. */
export function parseQuizText(input: string): ParsedQuiz {
  const lines = (input ?? "").replace(/\r\n?/g, "\n").split("\n");
  const questions: ParsedQuestion[] = [];
  let title = "";
  let current: ParsedQuestion | null = null;
  let pendingAnswer: string | null = null;

  const flush = () => {
    if (!current) return;
    if (pendingAnswer) {
      const idx = resolveAnswer(pendingAnswer, current.options);
      if (idx >= 0) current.options.forEach((o, i) => (o.is_correct = i === idx));
      pendingAnswer = null;
    }
    if (current.question_text && current.options.length >= 2) {
      const correctCount = current.options.filter((o) => o.is_correct).length;
      if (correctCount === 0) current.options[0].is_correct = true;
      if (correctCount > 1) {
        const first = current.options.findIndex((o) => o.is_correct);
        current.options.forEach((o, i) => (o.is_correct = i === first));
      }
      questions.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u00a0/g, " ").trimEnd();
    if (!line.trim()) continue;

    const titleMatch = line.match(TITLE_RE);
    if (titleMatch && !current) {
      title = titleMatch[1].trim();
      continue;
    }

    const answerMatch = line.match(ANSWER_RE);
    if (answerMatch && current) {
      pendingAnswer = answerMatch[1];
      continue;
    }

    const explMatch = line.match(EXPLANATION_RE);
    if (explMatch && current) {
      current.explanation = explMatch[1].trim();
      continue;
    }

    const checkbox = line.match(CHECKBOX_RE);
    if (checkbox && current) {
      const { text, correct } = cleanOption(checkbox[2]);
      if (text) current.options.push({ option_text: text, is_correct: correct || checkbox[1].toLowerCase() === "x" });
      continue;
    }

    const opt = line.match(OPTION_RE);
    if (opt && current) {
      const { text, correct } = cleanOption(opt[3]);
      if (text) current.options.push({ option_text: text, is_correct: correct || Boolean(opt[1]) });
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet && current) {
      const { text, correct } = cleanOption(bullet[2]);
      if (text) current.options.push({ option_text: text, is_correct: correct || Boolean(bullet[1]) });
      continue;
    }

    const q = line.match(QUESTION_RE);
    if (q) {
      flush();
      const { text } = cleanOption(q[2]);
      current = { question_text: text || q[2].trim(), explanation: "", options: [] };
      continue;
    }

    // Continuation of the question stem, or a title on the very first line.
    if (current && current.options.length === 0) {
      current.question_text = `${current.question_text} ${line.trim()}`.trim();
    } else if (!current && !title && questions.length === 0) {
      title = line.trim().slice(0, 200);
    }
  }
  flush();

  return { title, questions };
}

/** True when the deterministic parse produced something usable. */
export function isUsableParse(parsed: ParsedQuiz): boolean {
  return parsed.questions.length >= 1 && parsed.questions.every((q) => q.options.length >= 2);
}

export const ACCEPTED_IMPORT_TYPES = ".txt,.md,.csv,.pdf";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 60000;

/** Extract plain text from an uploaded quiz file (txt/md/csv natively, pdf via pdfjs). */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("File is too large (max 8 MB).");
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    // Worker bundled by Vite — keeps extraction off the main thread.
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerUrl;
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const out: string[] = [];
    const pageCount = Math.min(doc.numPages, 40);
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str?: string; hasEOL?: boolean }>;
      let pageText = "";
      for (const it of items) {
        pageText += (it.str ?? "") + (it.hasEOL ? "\n" : " ");
      }
      out.push(pageText);
    }
    return out.join("\n").replace(/[ \t]+/g, " ").slice(0, MAX_TEXT_CHARS);
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    throw new Error("Word files are not supported yet — export to PDF or paste the text.");
  }

  const text = await file.text();
  return text.slice(0, MAX_TEXT_CHARS);
}