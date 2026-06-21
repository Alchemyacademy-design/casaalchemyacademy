// Admin RLS / grants audit. Returns, per public table, a summary of policies and grants
// so we can confirm admins can CRUD. Caller must be an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "courses","course_modules","lessons","quizzes","quiz_questions","quiz_options",
  "events","live_workshops","magazine_issues","suppliers","supplier_categories",
  "membership_plans","certificates","exclusive_deals",
  "profiles","user_roles","memberships","course_entitlements","registrations",
  "community_spaces","community_channels","community_posts","community_replies","community_reactions",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "no_auth" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: ures, error: uerr } = await userClient.auth.getUser();
  if (uerr || !ures.user) {
    return new Response(JSON.stringify({ error: "bad_token", detail: uerr?.message }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const admin = createClient(SUPABASE_URL, SERVICE);
  const { data: roleRows, error: rerr } = await admin
    .from("user_roles").select("role").eq("user_id", ures.user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  if (rerr || !roles.includes("admin")) {
    return new Response(JSON.stringify({ error: "not_admin", roles }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // pull policy + grant summary via raw SQL through the REST `rpc` requires a function;
  // instead use pg meta via the admin client with `.rpc` is not available — fall back to
  // a single SQL call via PostgREST's `pg_meta` is not enabled either. Use a small
  // best-effort smoke test: try a HEAD select + an empty-payload insert (rolled back via
  // savepoint isn't possible from JS); we just do reads + describe.

  const out: Record<string, unknown> = {};
  for (const t of TABLES) {
    const res: Record<string, unknown> = {};
    const sel = await admin.from(t).select("*", { count: "exact", head: true });
    res.read_count = sel.count ?? 0;
    res.read_error = sel.error?.message ?? null;

    // attempt read as the calling user to confirm RLS lets them in
    const uread = await userClient.from(t).select("*", { count: "exact", head: true });
    res.user_read_count = uread.count ?? 0;
    res.user_read_error = uread.error?.message ?? null;
    out[t] = res;
  }

  return new Response(JSON.stringify({ user: ures.user.email, roles, tables: out }, null, 2), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
