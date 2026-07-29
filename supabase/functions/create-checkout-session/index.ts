import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22.2.1";
import { withSupabase } from "npm:@supabase/server@1.1.0";
import type { Database } from "../../../shared/supabase.types.ts";
import { env, evaluateCheckoutGate, expectedLivemode, stripeClient, supabaseAdmin } from "../_shared/billing-core.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

type OfferKey = "individual_course" | "monthly_member" | "annual_member";

type ExpectedTerms = {
  currency: "aud";
  unit_amount: number;
  interval: "month" | null;
  interval_count: number | null;
  mode: "subscription" | "payment";
};

function assertOfferKey(value: unknown): OfferKey {
  if (value === "individual_course" || value === "monthly_member" || value === "annual_member") return value;
  throw new Error("INVALID_OFFER_KEY");
}

function expectedTerms(offerKey: OfferKey): ExpectedTerms {
  if (offerKey === "individual_course") {
    return { currency: "aud", unit_amount: 15900, interval: "month", interval_count: 3, mode: "subscription" };
  }
  if (offerKey === "monthly_member") {
    return { currency: "aud", unit_amount: 9900, interval: "month", interval_count: 1, mode: "subscription" };
  }
  return { currency: "aud", unit_amount: 70800, interval: null, interval_count: null, mode: "payment" };
}

function safeMetadataValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
}

Deno.serve((request) => {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"), "x-idempotency-key");

  function corsJson(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const handler = withSupabase<Database>({ auth: "user", cors: corsHeaders }, async (request, ctx) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return corsJson({ error: "Method not allowed" }, 405);

  const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
  const user = userData.user;

  if (userError || !user?.id) return corsJson({ error: "UNAUTHORIZED" }, 401);
  if (!user.email) return corsJson({ error: "EMAIL_REQUIRED" }, 403);
  if (!user.email_confirmed_at) {
    return corsJson({ error: "EMAIL_NOT_CONFIRMED", message: "Confirm your email before continuing to payment." }, 403);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return corsJson({ error: "INVALID_JSON" }, 400);

  let offerKey: OfferKey;
  try {
    offerKey = assertOfferKey(body.offer_key);
  } catch {
    return corsJson({ error: "INVALID_OFFER_KEY" }, 400);
  }

  const requestedCourseId = Number(body.course_id);
  const courseId = offerKey === "individual_course" && Number.isInteger(requestedCourseId) && requestedCourseId > 0
    ? requestedCourseId
    : null;
  if (offerKey === "individual_course" && courseId === null) {
    return corsJson({ error: "COURSE_ID_REQUIRED" }, 400);
  }

  // Gate BEFORE creating any Stripe object (Customer, Checkout Session, etc.).
  const gate = evaluateCheckoutGate();
  if (!gate.ok) {
    return corsJson({ error: gate.code }, gate.status);
  }

  const supabase = supabaseAdmin();
  const stripe = stripeClient();
  const livemode = expectedLivemode();
  const terms = expectedTerms(offerKey);

  if (courseId !== null) {
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course) return corsJson({ error: "COURSE_NOT_PURCHASABLE" }, 400);
  }

  let priceQuery = supabase
    .from("stripe_prices")
    .select("stripe_price_id, stripe_product_id, plan_key, course_id, currency, unit_amount, recurring_interval, recurring_interval_count, livemode, active, is_checkout_default")
    .eq("plan_key", offerKey)
    .eq("livemode", livemode)
    .eq("currency", terms.currency)
    .eq("active", true)
    .eq("is_checkout_default", true);

  if (offerKey === "individual_course" && courseId !== null) {
    priceQuery = priceQuery.or(`course_id.eq.${courseId},course_id.is.null`);
  } else {
    priceQuery = priceQuery.is("course_id", null);
  }

  const { data: prices, error: priceError } = await priceQuery;
  if (priceError) throw priceError;

  const price = offerKey === "individual_course"
    ? prices?.find((candidate) => candidate.course_id === courseId) ?? prices?.find((candidate) => candidate.course_id === null)
    : prices?.[0];

  if (!price) return corsJson({ error: "PRICE_NOT_DETERMINISTIC" }, 409);
  if (
    price.unit_amount !== terms.unit_amount ||
    price.recurring_interval !== terms.interval ||
    price.recurring_interval_count !== terms.interval_count
  ) {
    return corsJson({ error: "PRICE_CONFIGURATION_MISMATCH" }, 409);
  }

  const windowStart = new Date(Math.floor(Date.now() / 600000) * 600000).toISOString();
  const idempotencyHeader = request.headers.get("x-idempotency-key") ?? crypto.randomUUID();

  const { data: existingLimit, error: readRateError } = await supabase
    .from("checkout_rate_limits")
    .select("attempt_count, last_idempotency_key, last_checkout_session_id")
    .eq("user_id", user.id)
    .eq("window_start", windowStart)
    .maybeSingle();
  if (readRateError) throw readRateError;

  if (existingLimit?.last_idempotency_key === idempotencyHeader && existingLimit.last_checkout_session_id) {
    const existingSession = await stripe.checkout.sessions.retrieve(existingLimit.last_checkout_session_id);
    if (existingSession.url) return corsJson({ checkout_url: existingSession.url });
  }

  if (existingLimit && existingLimit.attempt_count >= 5) return corsJson({ error: "RATE_LIMITED" }, 429);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const customerName = profile?.display_name ?? profile?.full_name ?? user.user_metadata?.full_name ?? undefined;
  const customerEmail = profile?.email ?? user.email;

  const { data: existingCustomer, error: customerReadError } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (customerReadError) throw customerReadError;

  let stripeCustomerId = existingCustomer?.stripe_customer_id ?? null;
  if (stripeCustomerId) {
    await stripe.customers.update(stripeCustomerId, {
      email: customerEmail,
      ...(customerName ? { name: customerName } : {}),
      metadata: { supabase_user_id: user.id },
    });
  } else {
    const createdCustomer = await stripe.customers.create({
      email: customerEmail,
      ...(customerName ? { name: customerName } : {}),
      metadata: { supabase_user_id: user.id },
    }, { idempotencyKey: `customer:${user.id}` });
    stripeCustomerId = createdCustomer.id;
  }

  const { error: customerWriteError } = await supabase.from("stripe_customers").upsert({
    user_id: user.id,
    stripe_customer_id: stripeCustomerId,
    email: customerEmail,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (customerWriteError) throw customerWriteError;

  const charityId = safeMetadataValue(body.charity_id);
  const metadata = {
    supabase_user_id: user.id,
    plan_key: offerKey,
    stripe_price_id: price.stripe_price_id,
    ...(courseId ? { course_id: String(courseId) } : {}),
    ...(charityId ? { charity_id: charityId } : {}),
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: terms.mode,
    customer: stripeCustomerId,
    client_reference_id: user.id,
    line_items: [{ price: price.stripe_price_id, quantity: 1 }],
    success_url: env("CHECKOUT_SUCCESS_URL"),
    cancel_url: env("CHECKOUT_CANCEL_URL"),
    metadata,
  };

  if (terms.mode === "subscription") {
    sessionParams.subscription_data = { metadata };
  } else {
    sessionParams.payment_intent_data = { metadata };
  }

  const idempotencyKey = `checkout:${user.id}:${offerKey}:${courseId ?? "all"}:${idempotencyHeader}`;
  const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey });
  if (!session.url) return corsJson({ error: "CHECKOUT_URL_MISSING" }, 502);

  await supabase.from("checkout_rate_limits").upsert({
    user_id: user.id,
    window_start: windowStart,
    attempt_count: existingLimit ? existingLimit.attempt_count + 1 : 1,
    last_idempotency_key: idempotencyHeader,
    last_checkout_session_id: session.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,window_start" });

  await supabase.from("stripe_checkout_sessions").upsert({
    stripe_session_id: session.id,
    user_id: user.id,
    stripe_customer_id: stripeCustomerId,
    stripe_price_id: price.stripe_price_id,
    status: session.status,
    payment_status: "pending",
    mode: session.mode,
    metadata,
  }, { onConflict: "stripe_session_id" });

    return corsJson({ checkout_url: session.url });
  });

  return handler(request);
});
