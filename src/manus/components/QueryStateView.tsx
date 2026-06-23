import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

/**
 * Standardised loading / error / empty wrapper for queries.
 * - Always exposes Retry on errors.
 * - Never confuses "error" with "empty".
 * - When `keepPreviousData` is on, the consumer should pass `isFetching` so we
 *   don't blank the page while a new page loads.
 */
export interface QueryStateViewProps {
  isLoading: boolean;
  isFetching?: boolean;
  error?: unknown;
  empty?: boolean;
  onRetry?: () => void;
  loadingFallback?: ReactNode;
  errorTitle?: string;
  emptyMessage?: ReactNode;
  /** Children render when not loading and not error. */
  children: ReactNode;
}

function errorMessage(e: unknown): string {
  if (!e) return "Unknown error";
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(e);
}

export default function QueryStateView({
  isLoading,
  isFetching,
  error,
  empty,
  onRetry,
  loadingFallback,
  errorTitle = "Something went wrong",
  emptyMessage = "No records.",
  children,
}: QueryStateViewProps) {
  if (error && !isFetching) {
    const msg = errorMessage(error);
    return (
      <Card className="p-6 border-destructive/40 text-sm" role="alert">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-destructive mb-1">{errorTitle}</div>
            <pre className="text-xs text-foreground/70 whitespace-pre-wrap break-words">{msg}</pre>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="mt-3">
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      loadingFallback ?? (
        <div className="flex items-center justify-center py-12 text-sm text-foreground/60" role="status" aria-live="polite">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
        </div>
      )
    );
  }

  if (empty) {
    return (
      <div className="py-12 text-center text-sm text-foreground/60">
        {emptyMessage}
      </div>
    );
  }

  return <>{children}</>;
}
