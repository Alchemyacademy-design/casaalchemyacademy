import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export type CompletionButtonProps = {
  completed: boolean;
  pending?: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export default function CompletionButton({ completed, pending, onToggle, disabled }: CompletionButtonProps) {
  return (
    <Button
      type="button"
      variant={completed ? "outline" : "default"}
      onClick={onToggle}
      disabled={disabled || pending}
      aria-pressed={completed}
    >
      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
      {completed ? "Completed" : "Mark Complete"}
    </Button>
  );
}
