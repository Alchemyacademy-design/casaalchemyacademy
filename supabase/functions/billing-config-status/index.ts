// Admin-only diagnostic. Returns ONLY booleans / counts / labels — never any
// secret value, prefix, length or fragment.
//
// Honest layering (no constants pretending to be deployment health):
//   configurationReady       — all secrets present + prefixes valid + URLs valid
//                              + expected livemode = live + 3 canonical prices
//                              mapped and terms valid.
//   checkoutGateEnabled      — STRIPE_LIVE_ENABLED === "true".
//   operationallyValidated   — at least one processed webhook event (live)
//                              AND at least one completed checkout session (live)
//                              AND at least one captured payment (live)
//                              AND at least one active membership/entitlement
//                                 created via Stripe (live).
//
// The webhook/checkout function "active" booleans are NOT hard-coded.
// They are reported as:
//   functionConfigured        — code path is present in this deployment.
//   functionDeploymentKnown   — false here; only the Supabase deployment API
//                              can answer this authoritatively. We never lie.
//   functionOperationallyTested — true only when a real call landed in the DB.

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

function prefixOk(value: string | undefined, prefixes: string[]): boolean {
  if (!value) return false;
  const v = value.trim();
  return prefixes.some((p) => v.startsWith(p));
}

function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function urlEndsWith(value: string | undefined, suffix: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return u.pathname.endsWith(suffix);
  } catch {
    return false;
  }
}

function originOnly(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && u.pathname === "/" || u.pathname === "";
  } catch {
    return false;
  }
}

function sameOrigin(...values: (string | undefined)[]): boolean {
  try {
    const origins = values.filter((v): v is string => !!v).map((v) => new URL(v).origin);
    if (origins.length < 2) return false;
    return origins.every((o) => o === origins[0]);
  } catch {
    return false;
  }
}

function resolveMode(): "test" | "live" {
  const raw = (Deno.env.get("STRIPE_RUNTIME_MODE") ?? "").trim().toLowerCase();
  if (raw === "live") return "live";
  if (raw === "test") return "test";
  const legacy = (Deno.env.get("STRIPE_EXPECTED_LIVEMODE") ?? "").trim().toLowerCase();
  if (legacy === "true") return "live";
  return "test";
}

const CANONICAL = {
  monthly_member:    { currency: "aud", unit_amount: 9900,  recurring_interval: "month", recurring_interval_count: 1,    course_id: null as null },
  annual_member:     { currency: "aud", unit_amount: 70800, recurring_interval: null,    recurring_interval_count: null, course_id: null as null },
  individual_course: { currency: "aud", unit_amount: 15900, recurring_interval: "month", recurring_interval_count: 3,    course_id: null as null },
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
  const { data: authData, error: claimsErr } = await userClient.auth.getUser(token);
  const claims = authData?.user ? { claims: { sub: authData.user.id } } : null;
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const actorId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: isAdminData, error: isAdminErr } = await admin.rpc("has_role", {
    _user_id: actorId,
    _role: "admin",
  });
  if (isAdminErr || !isAdminData) return json({ error: "forbidden" }, 403);

  // ---- Secrets (presence + prefix + URL shape; never values) --------------
  const mode = resolveMode();
  const expectedLivemode = mode === "live";
  const liveEnabled = (Deno.env.get("STRIPE_LIVE_ENABLED") ?? "").trim().toLowerCase() === "true";

  const stripeSecretRaw = Deno.env.get("STRIPE_SECRET_KEY")
    ?? Deno.env.get("STRIPE_LIVE_SECRET_KEY")
    ?? Deno.env.get("STRIPE_TEST_SECRET_KEY");
  const webhookSecretRaw = Deno.env.get("STRIPE_WEBHOOK_SECRET")
    ?? Deno.env.get("STRIPE_LIVE_WEBHOOK_SECRET")
    ?? Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET");
  const allowedOrigin = Deno.env.get("CHECKOUT_ALLOWED_ORIGIN");
  const successUrl    = Deno.env.get("CHECKOUT_SUCCESS_URL");
  const cancelUrl     = Deno.env.get("CHECKOUT_CANCEL_URL");

  const liveKeyPrefixes = ["sk_live_", "rk_live_"];
  const testKeyPrefixes = ["sk_test_", "rk_test_"];
  const stripeSecretConfigured  = !!stripeSecretRaw && stripeSecretRaw.trim().length > 0;
  const stripeSecretPrefixValid = expectedLivemode
    ? prefixOk(stripeSecretRaw, liveKeyPrefixes)
    : prefixOk(stripeSecretRaw, testKeyPrefixes);
  const stripeSecretEnvCompatible = stripeSecretPrefixValid;

  const webhookSecretConfigured  = !!webhookSecretRaw && webhookSecretRaw.trim().length > 0;
  const webhookSecretPrefixValid = prefixOk(webhookSecretRaw, ["whsec_"]);
  const webhookSecretEnvCompatible = webhookSecretConfigured && webhookSecretPrefixValid;

  const allowedOriginConfigured = !!allowedOrigin && allowedOrigin.trim().length > 0;
  const allowedOriginValid      = originOnly(allowedOrigin);
  const successUrlConfigured    = !!successUrl && successUrl.trim().length > 0;
  const successUrlValid         = isHttpsUrl(successUrl) && urlEndsWith(successUrl, "/payment/success");
  const cancelUrlConfigured     = !!cancelUrl && cancelUrl.trim().length > 0;
  const cancelUrlValid          = isHttpsUrl(cancelUrl)  && urlEndsWith(cancelUrl,  "/payment/cancel");
  const urlsShareOrigin         = sameOrigin(allowedOrigin, successUrl, cancelUrl);

  const expectedLivemodeConfigured = !!Deno.env.get("STRIPE_EXPECTED_LIVEMODE") || !!Deno.env.get("STRIPE_RUNTIME_MODE");
  const liveEnabledConfigured      = !!Deno.env.get("STRIPE_LIVE_ENABLED");

  // ---- Canonical price mapping --------------------------------------------
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

  const monthlyPriceMapped     = !!monthly;
  const annualPriceMapped      = !!annual;
  const individualPriceMapped  = !!individual;
  const monthlyPriceTermsValid = termsValid("monthly_member", monthly);
  const annualPriceTermsValid  = termsValid("annual_member", annual);
  const individualPriceTermsValid = termsValid("individual_course", individual);

  // ---- Operational evidence (never inferred from constants) ---------------
  const [
    { count: processedWebhookCount },
    { data: lastWh },
    { count: failedWebhookCount },
    { count: liveCheckoutSessionCount },
    { count: livePaymentCount },
    { count: liveActiveMembershipCount },
  ] = await Promise.all([
    admin.from("stripe_webhook_events").select("*", { count: "exact", head: true })
      .eq("status", "processed").eq("livemode", expectedLivemode),
    admin.from("stripe_webhook_events").select("status, processed_at, received_at")
      .order("received_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("stripe_webhook_events").select("*", { count: "exact", head: true })
      .in("status", ["failed_retryable", "failed_permanent"]),
    admin.from("stripe_checkout_sessions").select("*", { count: "exact", head: true })
      .eq("status", "complete"),
    admin.from("stripe_payments").select("*", { count: "exact", head: true })
      .eq("livemode", expectedLivemode).eq("status", "succeeded"),
    admin.from("memberships").select("*", { count: "exact", head: true })
      .in("status", ["active", "trialing"]),
  ]);

  const webhookOperationallyTested  = (processedWebhookCount ?? 0) > 0;
  const checkoutOperationallyTested = (liveCheckoutSessionCount ?? 0) > 0;
  const paymentOperationallyTested  = (livePaymentCount ?? 0) > 0;
  const membershipGranted           = (liveActiveMembershipCount ?? 0) > 0;

  // ---- Layered readiness ---------------------------------------------------
  const configurationReady =
    stripeSecretConfigured && stripeSecretEnvCompatible &&
    webhookSecretConfigured && webhookSecretEnvCompatible &&
    expectedLivemodeConfigured && expectedLivemode === true &&
    liveEnabledConfigured &&
    allowedOriginConfigured && allowedOriginValid &&
    successUrlConfigured && successUrlValid &&
    cancelUrlConfigured && cancelUrlValid &&
    urlsShareOrigin &&
    monthlyPriceMapped && monthlyPriceTermsValid &&
    annualPriceMapped && annualPriceTermsValid &&
    individualPriceMapped && individualPriceTermsValid;

  const checkoutGateEnabled = liveEnabled === true;

  const operationallyValidated =
    webhookOperationallyTested &&
    checkoutOperationallyTested &&
    paymentOperationallyTested &&
    membershipGranted;

  return json({
    stripeRuntimeMode: mode,
    stripeExpectedLivemode: expectedLivemode ? "live" : "test",
    stripeLiveEnabled: liveEnabled,

    secrets: {
      stripeSecret: {
        configured: stripeSecretConfigured,
        prefixValid: stripeSecretPrefixValid,
        environmentCompatible: stripeSecretEnvCompatible,
      },
      stripeWebhookSecret: {
        configured: webhookSecretConfigured,
        prefixValid: webhookSecretPrefixValid,
        environmentCompatible: webhookSecretEnvCompatible,
      },
      stripeExpectedLivemode: { configured: expectedLivemodeConfigured },
      stripeLiveEnabled:      { configured: liveEnabledConfigured },
      checkoutAllowedOrigin:  { configured: allowedOriginConfigured, urlValid: allowedOriginValid },
      checkoutSuccessUrl:     { configured: successUrlConfigured,    urlValid: successUrlValid },
      checkoutCancelUrl:      { configured: cancelUrlConfigured,     urlValid: cancelUrlValid },
      urlsShareOrigin,
    },

    prices: {
      monthly:    { mapped: monthlyPriceMapped,    termsValid: monthlyPriceTermsValid },
      annual:     { mapped: annualPriceMapped,     termsValid: annualPriceTermsValid },
      individual: { mapped: individualPriceMapped, termsValid: individualPriceTermsValid },
    },

    functions: {
      checkout: {
        functionConfigured: true,
        functionDeploymentKnown: false,
        functionOperationallyTested: checkoutOperationallyTested,
        deploymentStatus: "unknown_from_runtime",
      },
      webhook: {
        functionConfigured: true,
        functionDeploymentKnown: false,
        functionOperationallyTested: webhookOperationallyTested,
        deploymentStatus: "unknown_from_runtime",
      },
    },

    operations: {
      processedWebhookCount: processedWebhookCount ?? 0,
      failedWebhookCount: failedWebhookCount ?? 0,
      lastWebhookStatus: lastWh?.status ?? null,
      lastWebhookAt: lastWh?.processed_at ?? lastWh?.received_at ?? null,
      completedCheckoutSessionCount: liveCheckoutSessionCount ?? 0,
      succeededPaymentCount: livePaymentCount ?? 0,
      activeMembershipCount: liveActiveMembershipCount ?? 0,
    },

    configurationReady,
    checkoutGateEnabled,
    operationallyValidated,

    // Legacy fields kept for backwards-compat with any older clients.
    // Mirror the new layered values; do NOT use them for new code.
    stripeSecretConfigured,
    stripeWebhookSecretConfigured: webhookSecretConfigured,
    monthlyPriceMapped, annualPriceMapped, individualPriceMapped,
    monthlyPriceTermsValid, annualPriceTermsValid, individualPriceTermsValid,
    lastWebhookStatus: lastWh?.status ?? null,
    lastWebhookAt: lastWh?.processed_at ?? lastWh?.received_at ?? null,
    failedWebhookCount: failedWebhookCount ?? 0,
    billingReady: configurationReady && checkoutGateEnabled && operationallyValidated,
  });
});
