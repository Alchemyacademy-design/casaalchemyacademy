// Validates a `next` redirect target so we only ever bounce the user to a
// same-origin path we own. Anything else falls back to null so callers can
// use their default landing route.
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    // Must be a relative path starting with a single slash (block "//foo" and
    // "/\evil" schemes that some browsers treat as protocol-relative).
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
    // Round-trip through URL against the current origin to strip any embedded
    // scheme/host attempts.
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function readNextFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  return safeNext(p.get("next"));
}

export function withNext(path: string, next: string | null): string {
  if (!next) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}next=${encodeURIComponent(next)}`;
}