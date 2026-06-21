// One-shot, idempotent bootstrap for the designated platform admin.
// Hard-coded to ONLY ever grant the admin role to contact@casaalchemystudio.com.
// Safe to call multiple times. No auth required — the only side effect is
// granting admin to that single, hard-coded email if it already exists in auth.users.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const DESIGNATED_EMAIL = "contact@casaalchemystudio.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // 1. Find the designated user in auth.users
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;

    const target = list.users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === DESIGNATED_EMAIL,
    );

    if (!target) {
      return json({
        ok: false,
        message: `Designated admin ${DESIGNATED_EMAIL} not found in auth.users. Sign up first.`,
      }, 404);
    }

    // 2. Ensure 'admin' role exists in user_roles (idempotent)
    const { data: existing, error: selErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", target.id);
    if (selErr) throw selErr;

    const alreadyAdmin = (existing ?? []).some((r) => r.role === "admin");

    if (!alreadyAdmin) {
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: target.id, role: "admin" });
      if (insErr) throw insErr;
    }

    return json({
      ok: true,
      user_id: target.id,
      email: target.email,
      already_admin: alreadyAdmin,
      message: alreadyAdmin
        ? "User already had admin role. No change."
        : "Admin role granted. Sign out and sign back in to refresh your session.",
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object"
          ? JSON.stringify(err)
          : String(err);
    console.error("admin-bootstrap failed:", err);
    return json({ ok: false, error: "bootstrap_failed", message }, 500);
  }
});
