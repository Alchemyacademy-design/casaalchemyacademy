import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useLessonRating, useUpsertLessonRating } from "@/manus/lib/lesson-social";
import { useAuth } from "@/manus/hooks/useAuth";

type Props = {
  lessonId: number;
  courseId: number | null;
};

export default function LessonRating({ lessonId, courseId }: Props) {
  const { isAuthenticated } = useAuth();
  const query = useLessonRating(lessonId);
  const mutation = useUpsertLessonRating(lessonId, courseId);
  const [hover, setHover] = useState<number | null>(null);

  const summary = query.data;
  const displayed = hover ?? summary?.mine ?? 0;

  const submit = async (stars: number) => {
    if (!isAuthenticated) {
      toast.error("Sign in to rate this lesson");
      return;
    }
    try {
      await mutation.mutateAsync({ stars });
      toast.success("Thanks for your feedback!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save rating";
      toast.error(msg);
    }
  };

  return (
    <Card className="p-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="flex" role="radiogroup" aria-label="Rate this lesson">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= displayed;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={summary?.mine === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                disabled={mutation.isPending}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(null)}
                onClick={() => submit(n)}
                className="p-1 transition disabled:opacity-50"
              >
                <Star
                  className={`w-5 h-5 ${filled ? "fill-accent text-accent" : "text-foreground/40"}`}
                />
              </button>
            );
          })}
        </div>
        <span className="text-sm text-foreground/70">
          {summary ? summary.avg.toFixed(1) : "—"}
          <span className="text-foreground/50"> ({summary?.total ?? 0})</span>
        </span>
      </div>
      {summary?.mine ? (
        <span className="text-xs text-foreground/60">
          Your rating: {summary.mine}★
        </span>
      ) : (
        <span className="text-xs text-foreground/50">Tap a star to rate</span>
      )}
    </Card>
  );
}