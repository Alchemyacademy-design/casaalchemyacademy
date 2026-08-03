// Canonical public site URL for links embedded in emails.
// Never uses the request origin, so preview/sandbox hosts
// (*.lovableproject.com, *.lovable.app, localhost) never leak into emails.
const CANONICAL_FALLBACK = "https://casaalchemyacademy.com";

function normalize(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovable.dev")
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export const PUBLIC_SITE_URL: string =
  normalize(Deno.env.get("PUBLIC_SITE_URL")) ??
  normalize(Deno.env.get("APP_FRONTEND_URL")) ??
  normalize(Deno.env.get("SITE_URL")) ??
  CANONICAL_FALLBACK;

export function publicUrl(path: string): string {
  return `${PUBLIC_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
