// Objection-breaking quiz. Three strategic questions that surface the
// visitor's real block, then close with copy that says: whatever you
// picked, the Academy already covers it. No course recommendation, no
// login redirect — the goal is awareness, not a funnel step.

export type QuizOption = {
  id: string;
  label: string;
  /** The objection this answer reveals — echoed back on the closing screen. */
  objection: string;
  /** How the Academy already answers that objection. */
  answer: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  helper?: string;
  options: QuizOption[];
};

export const COURSE_QUIZ: QuizQuestion[] = [
  {
    id: "block",
    question: "What's really stopping you from designing your home the way you want?",
    options: [
      {
        id: "know",
        label: "I don't know where to start — every decision feels overwhelming",
        objection: "You feel stuck because no one ever taught you the order of decisions.",
        answer: "The Academy walks you through the exact sequence professional designers follow — palette, layout, materials, light — so nothing is guesswork.",
      },
      {
        id: "taste",
        label: "I don't trust my own taste",
        objection: "You second-guess yourself because taste feels like a mystery.",
        answer: "Taste is trained, not born. Every course inside the Academy is built to sharpen your eye until your instinct becomes your best tool.",
      },
      {
        id: "money",
        label: "I'm scared of spending money on the wrong things",
        objection: "You've been burned by expensive choices that didn't land.",
        answer: "The Academy teaches you to spend in the right order and on the right details — the trained eye is the cheapest tool in the room.",
      },
      {
        id: "time",
        label: "I don't have time for a big design project",
        objection: "You think good design means months of work you can't afford.",
        answer: "The Academy is built for real life — short, focused lessons you apply this week, not a course you never finish.",
      },
    ],
  },
  {
    id: "vision",
    question: "When you picture your home done well, what do you feel?",
    options: [
      {
        id: "calm",
        label: "Calm — a place that finally lets me breathe",
        objection: "You're craving a home that restores you.",
        answer: "Inside the Academy you'll learn the sensory foundations — light, texture, restraint — that turn any room into a place of rest.",
      },
      {
        id: "proud",
        label: "Proud — a home I love showing to people I care about",
        objection: "You want a home that speaks for you before you say a word.",
        answer: "The Academy teaches the crafted details that make a home feel generous, considered, and unmistakably yours.",
      },
      {
        id: "me",
        label: "Finally me — every room reflects who I actually am",
        objection: "You're tired of rooms that feel copied from someone else.",
        answer: "The Academy is built around personal design language — so every decision becomes an expression of you, not a Pinterest board.",
      },
      {
        id: "clarity",
        label: "Clarity — I finally know what to do next",
        objection: "You don't need more inspiration, you need a plan.",
        answer: "Every path in the Academy ends with a clear next action — no more scrolling, no more paralysis.",
      },
    ],
  },
  {
    id: "cost",
    question: "What's it costing you to leave your home the way it is?",
    options: [
      {
        id: "energy",
        label: "Energy — I never fully relax in my own space",
        objection: "Your home is quietly draining you every day.",
        answer: "The Academy fixes the design decisions that steal your peace so your home starts giving energy back instead of taking it.",
      },
      {
        id: "money2",
        label: "Money — I keep buying things that don't work",
        objection: "Every wrong purchase is a receipt for design you don't have yet.",
        answer: "The Academy gives you the framework to buy once, buy right — the ROI is the mistakes you never make.",
      },
      {
        id: "pride",
        label: "Pride — I don't invite people over the way I'd like to",
        objection: "Your home is holding back a version of your life you actually want.",
        answer: "The Academy is built to unlock that life — a home you're proud to open, not apologize for.",
      },
      {
        id: "years",
        label: "Years — I've been meaning to fix this for a long time",
        objection: "This has been on your list longer than you'd like to admit.",
        answer: "The Academy is designed to move you from 'someday' to 'started this week' — with lessons short enough to actually finish.",
      },
    ],
  },
];

export type QuizInsight = { objection: string; answer: string };

export function computeInsights(answers: Record<string, string>): QuizInsight[] {
  const out: QuizInsight[] = [];
  for (const q of COURSE_QUIZ) {
    const optId = answers[q.id];
    if (!optId) continue;
    const opt = q.options.find((o) => o.id === optId);
    if (opt) out.push({ objection: opt.objection, answer: opt.answer });
  }
  return out;
}