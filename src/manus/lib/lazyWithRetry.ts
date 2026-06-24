import { lazy, type ComponentType } from "react";

/**
 * Lazy-import a React component with a single, bounded auto-recovery for
 * stale dynamic-import chunks (typical after a fresh deploy invalidates the
 * previously-cached chunk hashes). Behaviour:
 *
 *   1. Attempt the import.
 *   2. If it fails AND looks like a chunk/dynamic-import failure AND we have
 *      not reloaded yet for this key, set a sessionStorage flag and reload.
 *   3. If it fails after a reload, rethrow so the ErrorBoundary handles it.
 *
 * The sessionStorage flag is scoped per chunk key so one bad chunk cannot
 * block other routes, and so a single reload per key is the hard upper bound.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  key: string,
) {
  const storageKey = `aa:lazy-retry:${key}`;
  return lazy<T>(() =>
    factory().catch((err: unknown) => {
      if (!isChunkLoadError(err)) throw err;
      const storage = safeSessionStorage();
      const alreadyRetried = storage?.getItem(storageKey) === "1";
      if (alreadyRetried) throw err;
      try {
        storage?.setItem(storageKey, "1");
      } catch {
        /* storage may be unavailable in private mode — fall through */
      }
      if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
        window.location.reload();
        // Return a never-resolving promise so React's Suspense keeps the
        // fallback visible while the reload happens.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string; code?: string };
  const name = (e.name ?? "").toLowerCase();
  const msg = (e.message ?? String(err)).toLowerCase();
  if (name === "chunkloaderror") return true;
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk")
  );
}

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Test-only helper to reset retry flags between cases. */
export function __resetLazyRetryFlags(prefix = "aa:lazy-retry:") {
  const storage = safeSessionStorage();
  if (!storage) return;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(prefix)) toRemove.push(k);
  }
  toRemove.forEach((k) => storage.removeItem(k));
}
