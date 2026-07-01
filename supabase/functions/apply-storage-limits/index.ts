// Raises file_size_limit and expands allowed_mime_types on the
// `public-assets` bucket. Workspace policy caps the max — probe from high
// to low and apply the first value that succeeds. Idempotent.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "public-assets";
const CANDIDATE_LIMITS = [
  200 * 1024 * 1024,
  100 * 1024 * 1024,
  50 * 1024 * 1024,
  25 * 1024 * 1024,
];
const ALLOWED_MIME_TYPES = [
  "image/*",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
  "video/x-m4v",
  "audio/mpeg",
  "audio/mp4",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const attempts: Array<{ limit: number; status: number; body: string }> = [];
  for (const limit of CANDIDATE_LIMITS) {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: BUCKET,
          name: BUCKET,
          public: true,
          file_size_limit: limit,
          allowed_mime_types: ALLOWED_MIME_TYPES,
        }),
      });
      const text = await res.text();
      attempts.push({ limit, status: res.status, body: text });
      if (res.ok) {
        return new Response(
          JSON.stringify({ ok: true, applied_limit: limit, allowed_mime_types: ALLOWED_MIME_TYPES, attempts }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e) {
      attempts.push({ limit, status: 0, body: String(e) });
    }
  }
  return new Response(JSON.stringify({ ok: false, attempts }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
