// One-shot admin endpoint to mark all unconfirmed users as confirmed.
// Protected by a header secret to avoid public abuse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let updated = 0;
    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        if (!u.email_confirmed_at) {
          const { error: upErr } = await supabase.auth.admin.updateUserById(u.id, {
            email_confirm: true,
          });
          if (upErr) {
            console.error("update fail", u.id, upErr.message);
          } else {
            updated += 1;
          }
        }
      }

      if (users.length < perPage) break;
      page += 1;
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
