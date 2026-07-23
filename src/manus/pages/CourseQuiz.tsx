import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { COURSE_QUIZ, computeInsights } from "@/manus/data/course-quiz-config";

type Stage = "quiz" | "result";

export default function CourseQuiz() {
  const [stage, setStage] = useState<Stage>("quiz");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const total = COURSE_QUIZ.length;
  const q = COURSE_QUIZ[step];
  const progress = Math.round(((step + (answers[q?.id ?? ""] ? 1 : 0)) / total) * 100);
  const insights = useMemo(() => computeInsights(answers), [answers]);

  function goToOffers() {
    window.location.href = "/#offers";
  }

  function choose(optId: string) {
    setAnswers((a) => ({ ...a, [q.id]: optId }));
    if (step + 1 < total) {
      setStep((s) => s + 1);
    } else {
      setStage("result");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--aa-cream, #f7f2ea)" }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="uppercase tracking-[0.2em] text-xs text-foreground/60 mb-4">Find your block</p>
        <h1 className="font-serif text-3xl md:text-5xl font-normal mb-4">
          What's really stopping you from designing your home?
        </h1>
        <p className="text-foreground/70 mb-10">
          Three quick questions. No sign-up, no email — just clarity on what's in your way.
        </p>

        {stage === "quiz" && q && (
          <div className="rounded-xl border border-foreground/10 bg-background p-6 md:p-8">
            <Progress value={progress} className="mb-6" />
            <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2">
              Question {step + 1} of {total}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-normal mb-6">{q.question}</h2>
            <div className="space-y-2">
              {q.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => choose(o.id)}
                  className={`w-full text-left rounded border px-4 py-3 transition-colors ${
                    answers[q.id] === o.id
                      ? "border-foreground bg-foreground/5"
                      : "border-foreground/15 hover:border-foreground/40"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-6">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
              <p className="text-xs text-foreground/50">Answers stay private.</p>
            </div>
          </div>
        )}

        {stage === "result" && (
          <div className="rounded-xl border border-foreground/10 bg-background p-6 md:p-8">
            <p className="uppercase tracking-[0.2em] text-xs text-foreground/60 mb-3">Here's what's really going on</p>
            {insights.length > 0 && (
              <ul className="space-y-6 mb-8">
                {insights.map((item, i) => (
                  <li key={i} className="border-l-2 border-foreground/20 pl-4">
                    <p className="text-foreground/90 font-medium mb-1">{item.objection}</p>
                    <p className="text-foreground/70 text-sm">{item.answer}</p>
                  </li>
                ))}
              </ul>
            )}
            <h2 className="font-serif text-2xl md:text-3xl font-normal mb-6">
              Everything you just named — the Academy is built exactly for that. This is the platform you've been looking for.
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={goToOffers}
                className="inline-flex items-center justify-center rounded px-6 py-3 bg-foreground text-background font-medium h-auto"
              >
                See how to join the Academy
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setStage("quiz"); setStep(0); setAnswers({}); }}
                className="inline-flex items-center justify-center rounded px-6 py-3 h-auto"
              >
                Retake the quiz
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}