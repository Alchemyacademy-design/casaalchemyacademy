import { Loader2 } from "lucide-react";

/**
 * Accessible Suspense fallback for lazily-loaded routes.
 *
 * Uses the existing AA cream surface to avoid harsh white flashes during
 * route transitions. Kept lightweight on purpose: this component must
 * remain in the eager bundle so it can render while the next chunk loads.
 */
export default function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--aa-cream, #faf7f1)" }}
    >
      <div className="flex flex-col items-center gap-3 text-sm" style={{ color: "var(--aa-text-mid, #5a5a5a)" }}>
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading page…</span>
      </div>
    </div>
  );
}
