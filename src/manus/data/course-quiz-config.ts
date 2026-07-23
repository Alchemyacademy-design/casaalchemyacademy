// Landing-page "Find your course" quiz configuration.
// Purpose: help visitors name their own pain point / theme.
// Does NOT recommend a specific course — the closing CTA points to the
// Academy pricing table (#offers) so any plan can be chosen.
// Not related to per-course learning quizzes (public.quizzes / QuizCard).

export type QuizOption = {
  id: string;
  label: string;
  /** Short insight surfaced in the closing message when this option is picked. */
  insight: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  helper?: string;
  options: QuizOption[];
};

export const COURSE_QUIZ: QuizQuestion[] = [
  {
    id: "pain",
    question: "What's bothering you most about your space right now?",
    options: [
      { id: "colour", label: "The colours never feel right, nothing matches or feels intentional", insight: "a palette that finally feels intentional" },
      { id: "living", label: "The living area doesn't feel practical to actually live in", insight: "a living room that works for real life" },
      { id: "dining", label: "It doesn't feel special for meals or entertaining", insight: "a dining space made for gathering" },
      { id: "bedroom", label: "It doesn't feel like a proper place to rest", insight: "a bedroom that truly restores you" },
    ],
  },
  {
    id: "style",
    question: "Which best describes the feeling you want at home?",
    options: [
      { id: "warm", label: "Warm, layered, full of character", insight: "warmth and layered character" },
      { id: "calm", label: "Calm, restful, spa-like", insight: "calm and restorative spaces" },
      { id: "bold", label: "Bold, colourful, expressive", insight: "bold, expressive colour" },
      { id: "hosting", label: "Elegant, made for hosting", insight: "elegance made for hosting" },
    ],
  },
  {
    id: "priority",
    question: "Which room would change the most if you got it right?",
    options: [
      { id: "bed", label: "Bedroom", insight: "the bedroom as your sanctuary" },
      { id: "liv", label: "Living room", insight: "the living room as the heart of the home" },
      { id: "din", label: "Dining room", insight: "the dining room as a place to gather" },
      { id: "col", label: "The palette across every room", insight: "a cohesive palette across every room" },
    ],
  },
];

export function computeInsights(answers: Record<string, string>): string[] {
  const insights: string[] = [];
  for (const q of COURSE_QUIZ) {
    const optId = answers[q.id];
    if (!optId) continue;
    const opt = q.options.find((o) => o.id === optId);
    if (opt) insights.push(opt.insight);
  }
  return insights;
}