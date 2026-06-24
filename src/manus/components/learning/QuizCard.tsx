import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  gradeAttempt,
  listAttempts,
  loadAdminQuiz,
  loadMemberQuiz,
  submitAttempt,
  type AdminQuestion,
  type MemberQuestion,
  type QuizRow,
  type SelectionMap,
} from "@/manus/services/quiz";
import QuizProgress from "./QuizProgress";
import QuizQuestion from "./QuizQuestion";
import QuizResult from "./QuizResult";

type Props = {
  quizId: number;
  /** Admin Preview Mode: never writes attempts, reveals correct options. */
  previewAsAdmin?: boolean;
};

export default function QuizCard({ quizId, previewAsAdmin = false }: Props) {
  const qc = useQueryClient();
  const quizQuery = useQuery({
    queryKey: ["quiz", quizId, { admin: previewAsAdmin }],
    queryFn: async () => (previewAsAdmin ? loadAdminQuiz(quizId) : loadMemberQuiz(quizId)),
    enabled: Number.isFinite(quizId) && quizId > 0,
  });
  const attemptsQuery = useQuery({
    queryKey: ["quiz-attempts", quizId],
    queryFn: () => listAttempts(quizId),
    enabled: !previewAsAdmin && Number.isFinite(quizId) && quizId > 0,
  });

  const [selections, setSelections] = useState<SelectionMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewGrade, setPreviewGrade] = useState<ReturnType<typeof gradeAttempt> | null>(null);

  const submitMutation = useMutation({
    mutationFn: () => submitAttempt(quizId, selections),
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["quiz-attempts", quizId] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  // Reset state when quiz changes.
  useEffect(() => {
    setSelections({});
    setCurrentIndex(0);
    setSubmitted(false);
    setError(null);
    setPreviewGrade(null);
  }, [quizId]);

  const data = quizQuery.data;
  const quiz: QuizRow | undefined = data?.quiz;
  const questions: ReadonlyArray<MemberQuestion | AdminQuestion> = data?.questions ?? [];
  const total = questions.length;
  const current = questions[currentIndex];

  const lastSubmittedAttempt = useMemo(() => {
    const submitted = (attemptsQuery.data ?? []).filter((a) => a.submitted_at != null);
    return submitted[0] ?? null;
  }, [attemptsQuery.data]);

  const attemptsRemaining = useMemo(() => {
    if (!quiz?.max_attempts) return null;
    const used = (attemptsQuery.data ?? []).filter((a) => a.submitted_at != null).length;
    return Math.max(0, quiz.max_attempts - used);
  }, [quiz, attemptsQuery.data]);

  if (quizQuery.isLoading) {
    return <Card className="p-6 text-sm text-foreground/60" role="status">Loading quiz…</Card>;
  }
  if (quizQuery.error) {
    return (
      <Card className="p-6 space-y-3">
        <p className="text-sm text-destructive">Failed to load quiz.</p>
        <Button variant="outline" size="sm" onClick={() => quizQuery.refetch()}>Retry</Button>
      </Card>
    );
  }
  if (!quiz) return null;
  if (total === 0) {
    return <Card className="p-6 text-sm text-foreground/60">This quiz has no questions yet.</Card>;
  }

  // Already-passed surface for members.
  if (!previewAsAdmin && lastSubmittedAttempt && lastSubmittedAttempt.passed && !submitted) {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="font-serif text-2xl text-foreground">{quiz.title}</h2>
        <QuizResult
          score={lastSubmittedAttempt.score ?? 0}
          passed={true}
          passingScore={quiz.passing_score}
          attemptsRemaining={attemptsRemaining}
        />
      </Card>
    );
  }

  if (submitted) {
    const score = lastSubmittedAttempt?.score ?? 0;
    const passed = lastSubmittedAttempt?.passed ?? false;
    return (
      <Card className="p-6 space-y-4">
        <h2 className="font-serif text-2xl text-foreground">{quiz.title}</h2>
        <QuizResult
          score={score}
          passed={passed}
          passingScore={quiz.passing_score}
          attemptsRemaining={attemptsRemaining}
          onRestart={() => {
            setSelections({});
            setCurrentIndex(0);
            setSubmitted(false);
            setError(null);
          }}
        />
      </Card>
    );
  }

  if (previewAsAdmin && previewGrade) {
    return (
      <Card className="p-6 space-y-4">
        <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800">Preview</span>
        <h2 className="font-serif text-2xl text-foreground">{quiz.title}</h2>
        <QuizResult
          score={previewGrade.score}
          passed={previewGrade.passed}
          passingScore={quiz.passing_score}
          attemptsRemaining={null}
          onRestart={() => {
            setSelections({});
            setCurrentIndex(0);
            setPreviewGrade(null);
          }}
        />
      </Card>
    );
  }

  const selected = current ? selections[current.id] ?? null : null;
  const isLast = currentIndex === total - 1;
  const isFirst = currentIndex === 0;
  const allAnswered = questions.every((q) => selections[q.id] != null);

  return (
    <Card className="p-6 space-y-5">
      {previewAsAdmin && (
        <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800">Preview</span>
      )}
      <div>
        <h2 className="font-serif text-2xl text-foreground">{quiz.title}</h2>
        {quiz.description && <p className="text-sm text-foreground/70 mt-1">{quiz.description}</p>}
      </div>
      <QuizProgress current={currentIndex + 1} total={total} passingScore={quiz.passing_score} />
      {current && (
        <QuizQuestion
          questionText={current.question_text}
          options={current.options.map((o) => ({ id: o.id, option_text: o.option_text }))}
          selectedOptionId={selected}
          onChange={(id) => setSelections((s) => ({ ...s, [current.id]: id }))}
        />
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      )}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isFirst}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          <ArrowLeft className="w-3 h-3 mr-1" /> Previous
        </Button>
        {isLast ? (
          <Button
            size="sm"
            disabled={!allAnswered || submitMutation.isPending}
            onClick={() => {
              setError(null);
              if (previewAsAdmin && "options" in (questions[0] ?? {}) && (questions[0] as AdminQuestion).options[0] && "is_correct" in (questions[0] as AdminQuestion).options[0]) {
                setPreviewGrade(
                  gradeAttempt(questions as ReadonlyArray<AdminQuestion>, selections, quiz.passing_score),
                );
                return;
              }
              submitMutation.mutate();
            }}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={selected == null}
            onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
          >
            Next <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}
