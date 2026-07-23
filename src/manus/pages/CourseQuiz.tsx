import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import LeadMagnetForm from "@/manus/components/LeadMagnetForm";
import { COURSE_QUIZ, computeInsights } from "@/manus/data/course-quiz-config";

type Stage = "quiz" | "gate" | "result";

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
      setStage("gate");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--aa-cream, #f7f2ea)" }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="uppercase tracking-[0.2em] text-xs text-foreground/60 mb-4">Course finder</p>
        <h1 className="font-serif text-3xl md:text-5xl font-normal mb-4">
          Not sure which course is right for you?
        </h1>
        <p className="text-foreground/70 mb-10">
          Take the quiz and find out — there's a gift at the end.
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

        {stage === "gate" && (
          <div className="rounded-xl border border-foreground/10 bg-background p-6 md:p-8">
            <h2 className="font-serif text-2xl md:text-3xl font-normal mb-2">
              Unlock your result and your free gift
            </h2>
            <p className="text-foreground/70 mb-6">
              Enter your details to reveal the course matched to you — plus a free copy of our latest magazine issue.
            </p>
            <LeadMagnetForm
              source="quiz"
              metadata={{ answers, insights }}
              ctaLabel="Reveal my result + magazine"
              onSubmitted={() => setStage("result")}
            />
            <button
              type="button"
              onClick={() => setStage("quiz")}
              className="text-xs text-foreground/50 mt-4 underline"
            >
              Go back and change my answers
            </button>
          </div>
        )}

        {stage === "result" && (
          <div className="rounded-xl border border-foreground/10 bg-background p-6 md:p-8">
            <p className="uppercase tracking-[0.2em] text-xs text-foreground/60 mb-3">What your answers reveal</p>
            {insights.length > 0 && (
              <ul className="space-y-3 mb-8">
                {insights.map((line, i) => (
                  <li key={i} className="flex gap-3 text-foreground/80">
                    <span className="text-foreground/40 mt-1">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            <h2 className="font-serif text-2xl md:text-3xl font-normal mb-6">
              This is exactly what the Academy trains you to see. Knowledge is the most democratic design tool there is — here's how to start.
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={goToOffers}
                className="inline-flex items-center justify-center rounded px-6 py-3 bg-foreground text-background font-medium h-auto"
              >
                See how to join the Academy
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}