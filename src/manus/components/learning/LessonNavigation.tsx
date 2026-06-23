import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type LessonNavigationProps = {
  currentIndex: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
};

export default function LessonNavigation({
  currentIndex,
  total,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: LessonNavigationProps) {
  return (
    <nav
      aria-label="Lesson navigation"
      className="flex items-center justify-between pt-6 border-t border-border/40"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={!hasPrevious}
        aria-label="Previous lesson"
      >
        <ChevronLeft className="w-4 h-4" /> Previous
      </Button>
      <span className="text-xs text-foreground/60" aria-live="polite">
        Lesson {Math.max(0, currentIndex) + 1} of {Math.max(0, total)}
      </span>
      <Button
        type="button"
        size="sm"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next lesson"
      >
        Next <ChevronRight className="w-4 h-4" />
      </Button>
    </nav>
  );
}
