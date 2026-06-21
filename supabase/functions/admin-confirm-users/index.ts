import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const reset = url.searchParams.get("reset_password");

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
  }));

  let resetResult: unknown = null;
  if (email && reset) {
    const target = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (target) {
      const { error: upErr } = await supabase.auth.admin.updateUserById(target.id, {
        password: reset,
        email_confirm: true,
      });
      resetResult = upErr ? { ok: false, error: upErr.message } : { ok: true, id: target.id };
    } else {
      resetResult = { ok: false, error: "user not found" };
    }
  }

  return new Response(JSON.stringify({ users, resetResult }, null, 2), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
