import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1.1.0";
import type { Database } from "../../../shared/supabase.types.ts";
import { env, stripeClient, supabaseAdmin } from "../_shared/billing-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": env("CHECKOUT_ALLOWED_ORIGIN"),
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function corsJson(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const handler = withSupabase<Database>({ auth: "user", cors: corsHeaders }, async (request, ctx) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return corsJson({ error: "Method not allowed" }, 405);

  const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user?.id) return corsJson({ error: "UNAUTHORIZED" }, 401);

  const supabase = supabaseAdmin();
  const { data: customer, error } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const stripe = stripeClient();
  let stripeCustomerId = customer?.stripe_customer_id ?? null;

  // Fallback: no local link yet (e.g. legacy checkouts, manual grants).
  // Try to locate the Stripe customer by the account email and backfill
  // the mapping so the billing portal works without admin intervention.
  if (!stripeCustomerId) {
    const email = user.email ?? null;
    if (email) {
      const found = await stripe.customers.list({ email, limit: 10 });
      const match = found.data
        .filter((c) => !c.deleted)
        .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];
      if (match?.id) {
        stripeCustomerId = match.id;
        await supabase.from("stripe_customers").upsert(
          { user_id: user.id, stripe_customer_id: match.id, email },
          { onConflict: "user_id" },
        );
      }
    }
  }

  if (!stripeCustomerId) return corsJson({ error: "NO_STRIPE_CUSTOMER" }, 404);

  const returnUrl = (() => {
    try {
      const body = request.headers.get("origin");
      if (body) return `${body}/profile`;
    } catch { /* noop */ }
    return env("CHECKOUT_SUCCESS_URL");
  })();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return corsJson({ portal_url: session.url });
});

Deno.serve(handler);