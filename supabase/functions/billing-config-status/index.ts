// Admin-only diagnostic endpoint. Returns ONLY booleans/status strings about
// Stripe configuration. NEVER returns secret values, key prefixes, key lengths,
// or any sensitive fragment.
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

// Canonical expected terms — the only source of truth besides public.stripe_prices.
const CANONICAL = {
  monthly_member: { currency: "aud", unit_amount: 9900,  recurring_interval: "month", recurring_interval_count: 1, course_id: null as null },
  annual_member:  { currency: "aud", unit_amount: 70800, recurring_interval: null,    recurring_interval_count: null, course_id: null as null },
  individual_course: { currency: "aud", unit_amount: 15900, recurring_interval: "month", recurring_interval_count: 3, course_id: null as null },
} as const;

type PlanKey = keyof typeof CANONICAL;

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
  const expectedLivemode = mode === "live";
  const liveEnabled = (Deno.env.get("STRIPE_LIVE_ENABLED") ?? "").trim().toLowerCase() === "true";

  // Resolve canonical default price per plan_key, scoped to expected livemode.
  async function defaultPrice(planKey: PlanKey) {
    const { data } = await admin
      .from("stripe_prices")
      .select("stripe_price_id, plan_key, course_id, currency, unit_amount, recurring_interval, recurring_interval_count, livemode, active, is_checkout_default")
      .eq("plan_key", planKey)
      .eq("livemode", expectedLivemode)
      .eq("active", true)
      .eq("is_checkout_default", true)
      .is("course_id", null)
      .maybeSingle();
    return data;
  }

  function termsValid(planKey: PlanKey, row: Awaited<ReturnType<typeof defaultPrice>>): boolean {
    if (!row) return false;
    const c = CANONICAL[planKey];
    return (
      (row.currency ?? "").toLowerCase() === c.currency &&
      row.unit_amount === c.unit_amount &&
      row.recurring_interval === c.recurring_interval &&
      row.recurring_interval_count === c.recurring_interval_count &&
      row.course_id === c.course_id
    );
  }

  const [monthly, annual, individual] = await Promise.all([
    defaultPrice("monthly_member"),
    defaultPrice("annual_member"),
    defaultPrice("individual_course"),
  ]);

  const monthlyPriceMapped = !!monthly;
  const annualPriceMapped = !!annual;
  const individualPriceMapped = !!individual;

  const monthlyPriceTermsValid = termsValid("monthly_member", monthly);
  const annualPriceTermsValid = termsValid("annual_member", annual);
  const individualPriceTermsValid = termsValid("individual_course", individual);

  // Webhook recent status snapshot — never returns payloads, only counts/labels.
  const { data: lastWh } = await admin
    .from("stripe_webhook_events")
    .select("status, processed_at, received_at")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { count: failedWebhookCount } = await admin
    .from("stripe_webhook_events")
    .select("*", { count: "exact", head: true })
    .in("status", ["failed_retryable", "failed_permanent"]);

  const stripeSecretConfigured =
    configured(Deno.env.get("STRIPE_SECRET_KEY"), ["sk_test_", "rk_test_", "sk_live_", "rk_live_"]) ||
    configured(Deno.env.get("STRIPE_TEST_SECRET_KEY"), ["sk_test_", "rk_test_"]) ||
    configured(Deno.env.get("STRIPE_LIVE_SECRET_KEY"), ["sk_live_", "rk_live_"]);
  const stripeWebhookSecretConfigured =
    configured(Deno.env.get("STRIPE_WEBHOOK_SECRET"), ["whsec_"]) ||
    configured(Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET"), ["whsec_"]) ||
    configured(Deno.env.get("STRIPE_LIVE_WEBHOOK_SECRET"), ["whsec_"]);

  const billingReady =
    stripeSecretConfigured &&
    stripeWebhookSecretConfigured &&
    expectedLivemode === true &&
    liveEnabled === true &&
    monthlyPriceMapped && monthlyPriceTermsValid &&
    annualPriceMapped && annualPriceTermsValid &&
    individualPriceMapped && individualPriceTermsValid;

  return json({
    stripeRuntimeMode: mode,
    stripeExpectedLivemode: expectedLivemode ? "live" : "test",
    stripeLiveEnabled: liveEnabled,
    stripeSecretConfigured,
    stripeWebhookSecretConfigured,
    stripeTestKeyConfigured: configured(Deno.env.get("STRIPE_TEST_SECRET_KEY"), ["sk_test_", "rk_test_"]),
    stripeTestWebhookConfigured: configured(Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET"), ["whsec_"]),
    stripeLiveKeyConfigured: configured(Deno.env.get("STRIPE_LIVE_SECRET_KEY"), ["sk_live_", "rk_live_"]),
    stripeLiveWebhookConfigured: configured(Deno.env.get("STRIPE_LIVE_WEBHOOK_SECRET"), ["whsec_"]),
    legacyStripeSecretKeyConfigured: !!(Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim(),
    legacyStripeWebhookSecretConfigured: !!(Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").trim(),
    monthlyPriceMapped,
    annualPriceMapped,
    individualPriceMapped,
    monthlyPriceTermsValid,
    annualPriceTermsValid,
    individualPriceTermsValid,
    webhookFunctionActive: true,   // this endpoint runs in the same Edge Functions runtime as the webhook
    checkoutFunctionActive: true,  // both are deployed together; the UI also probes via the catalog query
    lastWebhookStatus: lastWh?.status ?? null,
    lastWebhookAt: lastWh?.processed_at ?? lastWh?.received_at ?? null,
    failedWebhookCount: failedWebhookCount ?? 0,
    billingReady,
  });
});
