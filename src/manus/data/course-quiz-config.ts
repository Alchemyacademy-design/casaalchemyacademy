// Course-recommendation quiz configuration.
// Edit the questions/options here and the mapping is applied automatically.
// `courseSlug` matches a slug in public.courses (see /courses).
// If the recommended course does not exist yet, the quiz falls back to /courses.

export type QuizOption = {
  id: string;
  label: string;
  courseSlug: string;
  /** Weight added to the target course when this option is selected. */
  weight?: number;
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
      { id: "colour", label: "The colours never feel right, nothing matches or feels intentional", courseSlug: "the-path-to-a-colourful-life", weight: 3 },
      { id: "living", label: "The living area doesn't feel practical to actually live in", courseSlug: "the-soulful-living-room", weight: 3 },
      { id: "dining", label: "It doesn't feel special for meals or entertaining", courseSlug: "the-crafted-dining-room", weight: 3 },
      { id: "bedroom", label: "It doesn't feel like a proper place to rest", courseSlug: "the-sacred-bedroom", weight: 3 },
    ],
  },
  {
    id: "style",
    question: "Which best describes the feeling you want at home?",
    options: [
      { id: "warm", label: "Warm, layered, full of character", courseSlug: "the-soulful-living-room", weight: 1 },
      { id: "calm", label: "Calm, restful, spa-like", courseSlug: "the-sacred-bedroom", weight: 1 },
      { id: "bold", label: "Bold, colourful, expressive", courseSlug: "the-path-to-a-colourful-life", weight: 1 },
      { id: "hosting", label: "Elegant, made for hosting", courseSlug: "the-crafted-dining-room", weight: 1 },
    ],
  },
  {
    id: "priority",
    question: "Which room would change the most if you got it right?",
    options: [
      { id: "bed", label: "Bedroom", courseSlug: "the-sacred-bedroom", weight: 2 },
      { id: "liv", label: "Living room", courseSlug: "the-soulful-living-room", weight: 2 },
      { id: "din", label: "Dining room", courseSlug: "the-crafted-dining-room", weight: 2 },
      { id: "col", label: "The palette across every room", courseSlug: "the-path-to-a-colourful-life", weight: 2 },
    ],
  },
  {
    id: "timeline",
    question: "When do you plan to act on what you learn?",
    options: [
      { id: "now", label: "Right now — I'm mid-project", courseSlug: "the-path-to-a-colourful-life", weight: 1 },
      { id: "soon", label: "In the next few months", courseSlug: "the-soulful-living-room", weight: 1 },
      { id: "later", label: "Planning for the year ahead", courseSlug: "the-sacred-bedroom", weight: 1 },
      { id: "curious", label: "Just curious for now", courseSlug: "the-crafted-dining-room", weight: 1 },
    ],
  },
  {
    id: "budget",
    question: "How would you describe your budget?",
    options: [
      { id: "invest", label: "Ready to invest in a full transformation", courseSlug: "the-soulful-living-room", weight: 1 },
      { id: "modest", label: "Modest — I want to make the right decisions", courseSlug: "the-path-to-a-colourful-life", weight: 1 },
      { id: "focus", label: "Focused on one room at a time", courseSlug: "the-sacred-bedroom", weight: 1 },
      { id: "entertain", label: "Prioritising entertaining spaces", courseSlug: "the-crafted-dining-room", weight: 1 },
    ],
  },
];

export function computeRecommendation(answers: Record<string, string>): string {
  const scores: Record<string, number> = {};
  for (const q of COURSE_QUIZ) {
    const optId = answers[q.id];
    if (!optId) continue;
    const opt = q.options.find((o) => o.id === optId);
    if (!opt) continue;
    scores[opt.courseSlug] = (scores[opt.courseSlug] ?? 0) + (opt.weight ?? 1);
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "the-path-to-a-colourful-life";
}