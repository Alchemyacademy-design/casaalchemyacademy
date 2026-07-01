// Raises file_size_limit and expands allowed_mime_types on the
// `public-assets` bucket so admins can upload large PDFs, videos and images
// for the Magazine and other admin surfaces. Idempotent — safe to re-run.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "public-assets";
// Workspace caps bucket size; probe from high to low.
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
        file_size_limit: FILE_SIZE_LIMIT,
        allowed_mime_types: ALLOWED_MIME_TYPES,
      }),
    });
    const text = await res.text();
    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, response: text, applied: { file_size_limit: FILE_SIZE_LIMIT, allowed_mime_types: ALLOWED_MIME_TYPES } }),
      { status: res.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
