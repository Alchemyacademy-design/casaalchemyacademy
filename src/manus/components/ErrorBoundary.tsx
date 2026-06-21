import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Copy } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: Record<string, string> | null;
}

function extractSupabaseFields(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!err || typeof err !== "object") return out;
  const keys = [
    "code",
    "details",
    "hint",
    "source",
    "status",
    "statusCode",
    "function",
    "policy",
    "schema",
    "table",
    "column",
    "constraint",
    "name",
  ];
  for (const k of keys) {
    const v = (err as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  // Heuristic extraction from message: PostgREST often returns
  // "permission denied for table X" or "policy <name> ... on <table>".
  const msg = (err as { message?: string }).message ?? "";
  const policyMatch = msg.match(/policy\s+"([^"]+)"|policy\s+([A-Za-z0-9_]+)/i);
  if (policyMatch && !out.policy) out.policy = policyMatch[1] || policyMatch[2];
  const fnMatch = msg.match(/function\s+([A-Za-z0-9_.]+)/i);
  if (fnMatch && !out.function) out.function = fnMatch[1];
  return out;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, info: extractSupabaseFields(error) };
  }

  componentDidCatch(error: Error) {
    // Surface to console with full structure for debugging.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, extractSupabaseFields(error));
  }

  copy = () => {
    const { error, info } = this.state;
    const payload = JSON.stringify(
      { message: error?.message, ...info, stack: error?.stack },
      null,
      2,
    );
    void navigator.clipboard?.writeText(payload);
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { error, info } = this.state;
    const fields = info ?? {};
    const hasFields = Object.keys(fields).length > 0;

    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-background">
        <div className="flex flex-col items-start w-full max-w-3xl p-8">
          <AlertTriangle size={40} className="text-destructive mb-4" />
          <h2 className="text-xl font-serif mb-2">An unexpected error occurred</h2>
          <p className="text-sm text-foreground/80 mb-6 break-words">
            {error?.message ?? "Unknown error"}
          </p>

          {hasFields && (
            <div className="w-full mb-6 rounded-lg border border-border bg-muted/40 p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-foreground/60 mb-3">
                Supabase / backend details
              </h3>
              <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-xs">
                {Object.entries(fields).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-foreground/60 font-mono">{k}</dt>
                    <dd className="font-mono text-foreground break-words whitespace-pre-wrap">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {error?.stack && (
            <details className="w-full mb-6 rounded bg-muted p-4">
              <summary className="text-xs text-foreground/70 cursor-pointer select-none">
                Stack trace
              </summary>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-3">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground hover:opacity-90",
              )}
            >
              <RotateCcw size={16} /> Reload
            </button>
            <button
              onClick={this.copy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted"
            >
              <Copy size={16} /> Copy details
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
