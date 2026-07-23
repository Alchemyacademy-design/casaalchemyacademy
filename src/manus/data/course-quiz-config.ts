// Pain-point recognition quiz configuration.
// Each answer maps to a short closing insight/theme shown at the end.
// The quiz no longer recommends a single course — it points to the Academy as a whole.

export type QuizOption = {
  id: string;
  label: string;
  /** Short insight/theme surfaced in the closing message. */
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
      { id: "colour", label: "The colours never feel right, nothing matches or feels intentional", insight: "You're missing a palette language — the rules that make colour feel intentional." },
      { id: "living", label: "The living area doesn't feel practical to actually live in", insight: "Your living space needs a layout logic that balances comfort with everyday use." },
      { id: "dining", label: "It doesn't feel special for meals or entertaining", insight: "Your dining space is missing the rituals and details that turn a room into an occasion." },
      { id: "bedroom", label: "It doesn't feel like a proper place to rest", insight: "Your bedroom needs the sensory foundations — light, texture, quiet — that create true rest." },
    ],
  },
  {
    id: "style",
    question: "Which best describes the feeling you want at home?",
    options: [
      { id: "warm", label: "Warm, layered, full of character", insight: "You're chasing warmth — layered texture, story, and lived-in depth." },
      { id: "calm", label: "Calm, restful, spa-like", insight: "You're chasing calm — restraint, softness, and space to breathe." },
      { id: "bold", label: "Bold, colourful, expressive", insight: "You're chasing expression — confident colour and unapologetic personality." },
      { id: "hosting", label: "Elegant, made for hosting", insight: "You're chasing elegance — the crafted details that make a home feel generous." },
    ],
  },
  {
    id: "priority",
    question: "Which room would change the most if you got it right?",
    options: [
      { id: "bed", label: "Bedroom", insight: "The bedroom is where design most directly shapes how you feel every day." },
      { id: "liv", label: "Living room", insight: "The living room is the heart of the home — where design becomes daily life." },
      { id: "din", label: "Dining room", insight: "The dining room is where design turns everyday meals into memory." },
      { id: "col", label: "The palette across every room", insight: "A coherent palette is the single decision that pulls a whole home together." },
    ],
  },
  {
    id: "timeline",
    question: "When do you plan to act on what you learn?",
    options: [
      { id: "now", label: "Right now — I'm mid-project", insight: "You need frameworks you can apply this week — not theory for later." },
      { id: "soon", label: "In the next few months", insight: "You're planning ahead — the right time to build a real design foundation." },
      { id: "later", label: "Planning for the year ahead", insight: "You have time to learn deeply before deciding — the best position to be in." },
      { id: "curious", label: "Just curious for now", insight: "Curiosity is where every great home starts — trust it." },
    ],
  },
  {
    id: "budget",
    question: "How would you describe your budget?",
    options: [
      { id: "invest", label: "Ready to invest in a full transformation", insight: "With budget in hand, the biggest risk is spending it in the wrong order — knowledge fixes that." },
      { id: "modest", label: "Modest — I want to make the right decisions", insight: "A modest budget rewards the trained eye more than any other — every choice has to earn its place." },
      { id: "focus", label: "Focused on one room at a time", insight: "Room-by-room only works when each decision fits a bigger vision — that's what you're missing." },
      { id: "entertain", label: "Prioritising entertaining spaces", insight: "Entertaining spaces reward craft — the details guests never name but always feel." },
    ],
  },
];

export function computeInsights(answers: Record<string, string>): string[] {
  const out: string[] = [];
  for (const q of COURSE_QUIZ) {
    const optId = answers[q.id];
    if (!optId) continue;
    const opt = q.options.find((o) => o.id === optId);
    if (opt) out.push(opt.insight);
  }
  return out;
}