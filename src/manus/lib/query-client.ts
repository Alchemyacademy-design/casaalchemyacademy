import { QueryClient } from "@tanstack/react-query";

/**
 * Centralised query/mutation defaults.
 *
 * - `refetchOnWindowFocus: false` keeps the dashboard quiet on tab focus.
 *   Cross-tab freshness is handled explicitly by
 *   `src/manus/lib/cross-tab-query-sync.ts`, not by a blanket re-fetch.
 * - Query `retry` repeats GETs at most once and never on 4xx (auth, RLS or
 *   validation errors are not transient).
 * - Mutations never auto-retry — destructive actions must not be replayed
 *   silently by the cache layer.
 */
function is4xx(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: string };
  if (typeof e.status === "number" && e.status >= 400 && e.status < 500) return true;
  if (typeof e.code === "string" && /^(PGRST(301|302|3\d\d)|4\d\d|42501|23\d\d|22P02)$/.test(e.code)) return true;
  return false;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => !is4xx(error) && failureCount < 1,
    },
    mutations: {
      retry: false,
    },
  },
});
