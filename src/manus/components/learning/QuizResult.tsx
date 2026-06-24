import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  score: number;
  passed: boolean;
  passingScore: number;
  attemptsRemaining: number | null;
  onRestart?: () => void;
};

export default function QuizResult({ score, passed, passingScore, attemptsRemaining, onRestart }: Props) {
  return (
    <div className="space-y-4 text-center" role="status" aria-live="polite">
      <div className="flex justify-center">
        {passed ? (
          <CheckCircle2 className="w-12 h-12 text-emerald-500" aria-hidden="true" />
        ) : (
          <XCircle className="w-12 h-12 text-destructive" aria-hidden="true" />
        )}
      </div>
      <h3 className="font-serif text-2xl text-foreground">
        {passed ? "Quiz passed" : "Quiz not yet passed"}
      </h3>
      <p className="text-sm text-foreground/70">
        Your score: <strong>{score}%</strong> (passing score {passingScore}%)
      </p>
      {!passed && onRestart && attemptsRemaining !== 0 && (
        <Button variant="outline" onClick={onRestart}>
          Try again
          {attemptsRemaining != null && ` (${attemptsRemaining} left)`}
        </Button>
      )}
      {attemptsRemaining === 0 && (
        <p className="text-xs text-foreground/55">No attempts remaining.</p>
      )}
    </div>
  );
}
