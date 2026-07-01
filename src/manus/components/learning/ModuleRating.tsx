import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  moduleId: number;
  /** When true (admin preview), the component renders read-only and never writes. */
  readOnly?: boolean;
};

// PostgREST string-name access; the typed facade does not include this table
// until the migration in docs/migrations/20260625000000_*.sql is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

type Summary = { avg_rating: number; total: number };

// Errors raised when the module_ratings migration has not been applied yet.
// We treat them as "feature disabled" and hide the component silently.
const UNAVAILABLE_CODES = new Set(["42883", "42P01", "PGRST202", "PGRST205"]);
function isUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? "";
  if (code && UNAVAILABLE_CODES.has(code)) return true;
  return /does not exist|schema cache|module_rating_summary|module_ratings/i.test(message);
}

async function loadSummary(moduleId: number): Promise<Summary> {
  const { data, error } = await db.rpc("module_rating_summary", { p_module_id: moduleId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    avg_rating: Number(row?.avg_rating ?? 0),
    total: Number(row?.total ?? 0),
  };
}

async function loadMyRating(moduleId: number): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from("module_ratings")
    .select("rating")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.rating) : null;
}

async function upsertMyRating(moduleId: number, rating: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { error } = await db
    .from("module_ratings")
    .upsert(
      { user_id: user.id, module_id: moduleId, rating },
      { onConflict: "user_id,module_id" },
    );
  if (error) throw error;
}

export default function ModuleRating({ moduleId, readOnly = false }: Props) {
  const qc = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: ["module-rating-summary", moduleId],
    queryFn: () => loadSummary(moduleId),
    enabled: Number.isFinite(moduleId) && moduleId > 0,
  });
  const myQuery = useQuery({
    queryKey: ["module-rating-mine", moduleId],
    queryFn: () => loadMyRating(moduleId),
    enabled: !readOnly && Number.isFinite(moduleId) && moduleId > 0,
  });

  const [hover, setHover] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<number | null>(null);
  useEffect(() => setOptimistic(null), [moduleId]);

  const mutation = useMutation({
    mutationFn: (rating: number) => upsertMyRating(moduleId, rating),
    onMutate: (rating) => setOptimistic(rating),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["module-rating-summary", moduleId] }),
        qc.invalidateQueries({ queryKey: ["module-rating-mine", moduleId] }),
      ]);
      setOptimistic(null);
    },
    onError: () => setOptimistic(null),
  });

  const yourRating = optimistic ?? myQuery.data ?? null;
  const displayed = hover ?? yourRating ?? 0;
  const summary = summaryQuery.data;

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  if (summaryQuery.isLoading || (!readOnly && myQuery.isLoading)) {
    return (
      <Card className="p-5 text-sm text-foreground/60" role="status">
        Loading rating…
      </Card>
    );
  }

  if (summaryQuery.error || myQuery.error) {
    if (isUnavailable(summaryQuery.error) || isUnavailable(myQuery.error)) {
      return null;
    }
    return (
      <Card className="p-5 space-y-3">
        <p className="text-sm text-destructive">Failed to load rating.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            summaryQuery.refetch();
            if (!readOnly) myQuery.refetch();
          }}
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="font-serif text-lg text-foreground">Rate this module</h3>
        {summary && summary.total > 0 ? (
          <p className="text-xs text-foreground/65">
            Average <strong className="text-foreground/85">{summary.avg_rating.toFixed(1)}</strong>
            {" / 5 · "}
            {summary.total} {summary.total === 1 ? "rating" : "ratings"}
          </p>
        ) : (
          <p className="text-xs text-foreground/55">No ratings yet — be the first.</p>
        )}
      </div>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Rate this module from 1 to 5 stars"
        onMouseLeave={() => setHover(null)}
      >
        {stars.map((n) => {
          const filled = n <= displayed;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={yourRating === n}
              aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              disabled={readOnly || mutation.isPending}
              onMouseEnter={() => !readOnly && setHover(n)}
              onClick={() => !readOnly && mutation.mutate(n)}
              className="p-1 transition-transform hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Star
                className={`w-6 h-6 ${
                  filled ? "fill-amber-400 text-amber-400" : "text-foreground/30"
                }`}
              />
            </button>
          );
        })}
        {yourRating != null && (
          <span className="ml-3 text-xs text-foreground/65">Your rating: {yourRating}/5</span>
        )}
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive" role="alert">
          Could not save your rating. Please try again.
        </p>
      )}
    </Card>
  );
}
