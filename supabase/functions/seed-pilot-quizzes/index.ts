// DEPRECATED: pilot quiz seeder disabled. Admins now create their own quizzes
// through /admin/quizzes. Kept as a stub returning 410 Gone to prevent
// accidental re-seeding.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "gone",
      message: "seed-pilot-quizzes is deprecated. Create quizzes via /admin/quizzes.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
