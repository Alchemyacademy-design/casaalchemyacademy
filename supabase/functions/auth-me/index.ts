// auth-me: returns the authenticated user's profile, roles, membership, and
// active course entitlements. Uses service role internally but always scopes
// reads to the caller's own auth.uid — never returns data for other users.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const DESIGNATED_ADMIN_EMAIL = "contact@casaalchemystudio.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;
  const email = (userData.user.email ?? "").trim().toLowerCase();

  const admin = createClient(SUPABASE_URL, SERVICE);
  const nowIso = new Date().toISOString();

  try {
    if (email === DESIGNATED_ADMIN_EMAIL) {
      const { error: roleErr } = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      if (roleErr) throw roleErr;
    }

    const [profileRes, rolesRes, membershipRes, entitlementsRes] = await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
      admin
        .from("memberships")
        .select("plan_key,status,ends_at,starts_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("ends_at", nowIso)
        .order("ends_at", { ascending: false })
        .limit(1),
      admin
        .from("course_entitlements")
        .select("id,course_id,active,starts_at,ends_at,stripe_checkout_session_id,stripe_price_id")
        .eq("user_id", userId)
        .eq("active", true)
        .gt("ends_at", nowIso),
    ]);

    return json({
      profile: profileRes.data ?? null,
      roles: ((rolesRes.data as Array<{ role: string }> | null) ?? []).map((r) => r.role),
      membership: ((membershipRes.data as Array<Record<string, unknown>> | null) ?? [])[0] ?? null,
      activeEntitlements: entitlementsRes.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "auth_me_failed", message }, 500);
  }
});
