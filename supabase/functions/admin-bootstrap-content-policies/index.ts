import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const CONTENT_TABLES = ["courses", "course_modules", "lessons"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const out: { step: string; ok: boolean; error?: string }[] = [];
  const step = async (s: string, q: string) => {
    try { await sql.unsafe(q); out.push({ step: s, ok: true }); }
    catch (e) { out.push({ step: s, ok: false, error: (e as Error).message }); }
  };
  try {
    for (const t of CONTENT_TABLES) {
      await step(`drop_${t}`, `DROP POLICY IF EXISTS admin_full_access ON public.${t}`);
      await step(`policy_${t}`, `CREATE POLICY admin_full_access ON public.${t}
        FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role))`);
      await step(`grant_auth_${t}`, `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${t} TO authenticated`);
      await step(`grant_anon_select_${t}`, `GRANT SELECT ON public.${t} TO anon`);
      await step(`grant_service_${t}`, `GRANT ALL ON public.${t} TO service_role`);
    }
    // identity sequences ownership safety (no-op if not sequence-backed)
    await step("usage_anon_seq", "GRANT USAGE ON SCHEMA public TO anon, authenticated");
  } finally {
    await sql.end({ timeout: 5 });
  }
  return new Response(JSON.stringify({ steps: out }, null, 2), {
    status: out.some((s) => !s.ok) ? 207 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
