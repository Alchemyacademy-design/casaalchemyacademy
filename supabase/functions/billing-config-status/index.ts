// Admin-only diagnostic endpoint. Returns ONLY booleans about Stripe configuration.
// NEVER returns secret values, key prefixes, key lengths, or sensitive fragments.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

function configured(value: string | undefined, prefixes: string[]): boolean {
  if (!value) return false;
  const v = value.trim();
  return prefixes.some((p) => v.startsWith(p));
}

function resolveMode(): "test" | "live" {
  const raw = (Deno.env.get("STRIPE_RUNTIME_MODE") ?? "").trim().toLowerCase();
  if (raw === "live") return "live";
  if (raw === "test") return "test";
  const legacy = (Deno.env.get("STRIPE_EXPECTED_LIVEMODE") ?? "").trim().toLowerCase();
  if (legacy === "true") return "live";
  return "test";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const actorId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: isAdminData, error: isAdminErr } = await admin.rpc("has_role", {
    _user_id: actorId,
    _role: "admin",
  });
  if (isAdminErr || !isAdminData) return json({ error: "forbidden" }, 403);

  const mode = resolveMode();
  const liveEnabled = (Deno.env.get("STRIPE_LIVE_ENABLED") ?? "").trim().toLowerCase() === "true";

  // Optional Price-ID env vars; values are never returned, only mapping status.
  const monthlyPriceEnv = (Deno.env.get("STRIPE_LIVE_MONTHLY_PRICE_ID") ?? "").trim();
  const annualPriceEnv = (Deno.env.get("STRIPE_LIVE_ANNUAL_PRICE_ID") ?? "").trim();
  const coursePriceEnv = (Deno.env.get("STRIPE_LIVE_COURSE_PRICE_ID") ?? "").trim();

  async function pricePresent(priceId: string, planKey: string): Promise<boolean> {
    if (!priceId) return false;
    const { data } = await admin
      .from("stripe_prices")
      .select("stripe_price_id")
      .eq("stripe_price_id", priceId)
      .eq("plan_key", planKey)
      .eq("livemode", true)
      .eq("active", true)
      .eq("is_checkout_default", true)
      .maybeSingle();
    return !!data;
  }

  const [liveMonthlyPriceMapped, liveAnnualPriceMapped, liveCoursePriceMapped] = await Promise.all([
    pricePresent(monthlyPriceEnv, "monthly_member"),
    pricePresent(annualPriceEnv, "annual_member"),
    pricePresent(coursePriceEnv, "individual_course"),
  ]);

  return json({
    stripeRuntimeMode: mode,
    stripeLiveEnabled: liveEnabled,
    stripeTestKeyConfigured: configured(Deno.env.get("STRIPE_TEST_SECRET_KEY"), ["sk_test_", "rk_test_"]),
    stripeTestWebhookConfigured: configured(Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET"), ["whsec_"]),
    stripeLiveKeyConfigured: configured(Deno.env.get("STRIPE_LIVE_SECRET_KEY"), ["sk_live_", "rk_live_"]),
    stripeLiveWebhookConfigured: configured(Deno.env.get("STRIPE_LIVE_WEBHOOK_SECRET"), ["whsec_"]),
    legacyStripeSecretKeyConfigured: !!(Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim(),
    legacyStripeWebhookSecretConfigured: !!(Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").trim(),
    liveMonthlyPriceMapped,
    liveAnnualPriceMapped,
    liveCoursePriceMapped,
  });
});
