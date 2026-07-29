// Resolves CORS headers against an allow-list of origins instead of a single
// fixed value. CHECKOUT_ALLOWED_ORIGIN may now contain a comma-separated list
// (e.g. "https://casaalchemyacademy.com,https://casaalchemyacademy.lovable.app").
// The response reflects back the request's actual Origin only when it's on
// the allow-list; otherwise it falls back to the first configured origin so
// the response is still well-formed (the browser will still correctly block
// any origin not on the list — this does not weaken security, it just stops
// a single-value env var from silently breaking every other allowed domain).

function resolveAllowedOrigins(): string[] {
  const raw = Deno.env.get("CHECKOUT_ALLOWED_ORIGIN") ?? "";
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

export function resolveCorsOrigin(requestOrigin: string | null): string {
  const allowed = resolveAllowedOrigins();
  if (allowed.length === 0) return "";
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0];
}

export function buildCorsHeaders(requestOrigin: string | null, extraAllowedHeaders = ""): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(requestOrigin),
    "Access-Control-Allow-Headers": `authorization, apikey, content-type, x-client-info${extraAllowedHeaders ? ", " + extraAllowedHeaders : ""}`,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}