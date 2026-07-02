import Stripe from "npm:stripe@22.2.1";
import { createAdminClient } from "npm:@supabase/server@1.1.0/core";
import type { Database } from "../../../shared/supabase.types.ts";

export const STRIPE_API_VERSION = "2026-05-27.dahlia" as const;
export const MAX_RECOVERY_BATCH_SIZE = 25;

// Canonical attributes for the AUD 708 annual-member one-time Price.
// Source of truth = public.stripe_prices. No Stripe Price ID is hardcoded;
// optional cross-validation against STRIPE_LIVE_ANNUAL_PRICE_ID is advisory.
export const ANNUAL_MEMBER_CANONICAL = {
  plan_key: "annual_member" as const,
  currency: "aud" as const,
  unit_amount: 70800,
  recurring_interval: null as null,
  recurring_interval_count: null as null,
  active: true as const,
};

export type StripeRuntimeMode = "test" | "live";

export type SupabaseAdmin = ReturnType<typeof createAdminClient<Database>>;
type TerminalStatus = "processed" | "processed_ignored" | "processed_ignored_stale" | "failed_retryable" | "failed_permanent";
type InvoiceLineLike = {
  price?: { id?: string } | null;
  pricing?: {
    type?: string;
    price_details?: {
      price?: string | { id?: string } | null;
    } | null;
  } | null;
};

class BillingError extends Error {
  constructor(message: string, public status: TerminalStatus = "failed_permanent", public reason = message) {
    super(message);
  }
}

class IgnoredEvent extends BillingError {
  constructor(reason: string, stale = false) {
    super(reason, stale ? "processed_ignored_stale" : "processed_ignored", reason);
  }
}

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function envOpt(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

// ----- Runtime-mode + secret resolution.
// Mirrors src/manus/services/billing-runtime.ts (Deno cannot import from src/).

export function stripeRuntimeMode(): StripeRuntimeMode {
  const raw = (envOpt("STRIPE_RUNTIME_MODE") ?? "").trim().toLowerCase();
  if (raw === "live") return "live";
  if (raw === "test") return "test";
  const legacy = (envOpt("STRIPE_EXPECTED_LIVEMODE") ?? "").trim().toLowerCase();
  if (legacy === "true") return "live";
  if (legacy === "false") return "test";
  return "test";
}

export function stripeLiveEnabled(): boolean {
  return (envOpt("STRIPE_LIVE_ENABLED") ?? "").trim().toLowerCase() === "true";
}

export function expectedLivemode(): boolean {
  return stripeRuntimeMode() === "live";
}

function validateSecretKeyPrefix(mode: StripeRuntimeMode, key: string) {
  if (mode === "test") {
    if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
      throw new BillingError("BILLING_SECRET_KEY_PREFIX_MISMATCH");
    }
  } else if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) {
    throw new BillingError("BILLING_SECRET_KEY_PREFIX_MISMATCH");
  }
}

function validateWebhookSecretPrefix(secret: string) {
  if (!secret.startsWith("whsec_")) throw new BillingError("BILLING_WEBHOOK_SECRET_PREFIX_MISMATCH");
}

export function stripeSecretKey(): string {
  const mode = stripeRuntimeMode();
  const scoped = mode === "live" ? envOpt("STRIPE_LIVE_SECRET_KEY") : envOpt("STRIPE_TEST_SECRET_KEY");
  const legacy = envOpt("STRIPE_SECRET_KEY");
  const value = (scoped ?? legacy ?? "").trim();
  if (!value) throw new BillingError("BILLING_SECRET_KEY_MISSING");
  validateSecretKeyPrefix(mode, value);
  return value;
}

export function stripeWebhookSecret(): string {
  const mode = stripeRuntimeMode();
  const scoped = mode === "live" ? envOpt("STRIPE_LIVE_WEBHOOK_SECRET") : envOpt("STRIPE_TEST_WEBHOOK_SECRET");
  const legacy = envOpt("STRIPE_WEBHOOK_SECRET");
  const value = (scoped ?? legacy ?? "").trim();
  if (!value) throw new BillingError("BILLING_WEBHOOK_SECRET_MISSING");
  validateWebhookSecretPrefix(value);
  return value;
}

/**
 * Returns { ok: true } when checkout is allowed in the current runtime.
 * In live mode, requires STRIPE_LIVE_ENABLED=true. Never returns or logs the secret.
 */
export function evaluateCheckoutGate(): { ok: true } | { ok: false; code: string; status: number } {
  const mode = stripeRuntimeMode();
  if (mode === "live" && !stripeLiveEnabled()) {
    return { ok: false, code: "BILLING_LIVE_DISABLED", status: 503 };
  }
  try {
    stripeSecretKey();
  } catch (err) {
    const code = err instanceof Error && err.message.startsWith("BILLING_") ? err.message : "BILLING_SECRET_KEY_MISSING";
    return { ok: false, code, status: 500 };
  }
  return { ok: true };
}

export function billingSecretKey(): string {
  const keys = JSON.parse(env("SUPABASE_SECRET_KEYS")) as Record<string, string>;
  const billingKey = keys.billing;
  if (!billingKey) throw new Error("Missing named Supabase Secret Key: billing");
  return billingKey;
}

export function supabaseAdmin(): SupabaseAdmin {
  billingSecretKey();
  return createAdminClient<Database>({ auth: { keyName: "billing" }, supabaseOptions: { auth: { persistSession: false, autoRefreshToken: false } } });
}

export function stripeClient(): Stripe {
  return new Stripe(stripeSecretKey(), { apiVersion: STRIPE_API_VERSION, httpClient: Stripe.createFetchHttpClient() });
}

function objectId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function eventCreatedAt(event: Stripe.Event): string {
  return new Date(event.created * 1000).toISOString();
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  return isUuid(metadata?.supabase_user_id) ? metadata.supabase_user_id : null;
}

// Payment-Link fallback: if the Subscription doesn't yet carry
// supabase_user_id in its metadata, resolve it via the most recent
// checkout session for the same subscription/customer.
async function resolveUserIdForSubscription(
  supabase: SupabaseAdmin,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const customerId = objectId(subscription.customer);
  const { data } = await supabase
    .from("stripe_checkout_sessions")
    .select("user_id, created_at, stripe_customer_id")
    .eq("stripe_customer_id", customerId ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return isUuid(data?.user_id) ? (data!.user_id as string) : null;
}

function metadataCourseId(...sources: Array<Stripe.Metadata | null | undefined>): number | null {
  for (const metadata of sources) {
    const raw = metadata?.course_id;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const record = invoice as unknown as { parent?: { type?: string; subscription_details?: { subscription?: string | { id?: string } | null } | null } | null };
  const subscriptionRef = record.parent?.type === "subscription_details" ? record.parent.subscription_details?.subscription : null;
  return typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;
}

function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const record = invoice as unknown as { payments?: { data?: Array<{ payment?: { type?: string; payment_intent?: string | { id?: string } | null } | null }> } | null };
  for (const row of record.payments?.data ?? []) {
    const paymentIntent = row.payment?.type === "payment_intent" ? row.payment.payment_intent : null;
    const id = objectId(paymentIntent);
    if (id) return id;
  }
  return null;
}

function invoiceLinePriceId(invoice: Stripe.Invoice): string | null {
  const record = invoice as unknown as { lines?: { data?: InvoiceLineLike[] } | null };
  const line = record.lines?.data?.[0];
  if (!line) return null;
  if (line.pricing?.type === "price_details") return objectId(line.pricing.price_details?.price);
  return objectId(line.price);
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as unknown as { current_period_start?: number; current_period_end?: number };
  if (!item.current_period_start || !item.current_period_end) throw new BillingError(`Subscription ${subscription.id} missing current period`);
  return {
    start: new Date(item.current_period_start * 1000).toISOString(),
    end: new Date(item.current_period_end * 1000).toISOString(),
  };
}

export async function claimWebhookEvent(supabase: SupabaseAdmin, event: Stripe.Event) {
  const { data, error } = await supabase.rpc("internal_claim_stripe_webhook_event", {
    p_stripe_event_id: event.id,
    p_event_type: event.type,
    p_payload: event as unknown as Database["public"]["Functions"]["internal_claim_stripe_webhook_event"]["Args"]["p_payload"],
    p_stripe_event_created_at: eventCreatedAt(event),
    p_livemode: event.livemode,
    p_lease_seconds: 600,
    p_max_attempts: 5,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as { result: string; webhook_event_id: number };
}

async function markWebhookEvent(supabase: SupabaseAdmin, eventId: string, status: TerminalStatus, error: string | null = null, reason: string | null = null) {
  const args: Database["public"]["Functions"]["internal_mark_stripe_webhook_event"]["Args"] = {
    p_stripe_event_id: eventId,
    p_status: status,
    ...(error === null ? {} : { p_error: error }),
    ...(reason === null ? {} : { p_ignored_reason: reason }),
  };
  const { error: rpcError } = await supabase.rpc("internal_mark_stripe_webhook_event", args);
  if (rpcError) throw rpcError;
}

async function priceMapping(supabase: SupabaseAdmin, priceId: string, livemode: boolean) {
  const { data, error } = await supabase
    .from("stripe_prices")
    .select("stripe_price_id, stripe_product_id, plan_key, course_id, currency, unit_amount, recurring_interval, recurring_interval_count, livemode, active")
    .eq("stripe_price_id", priceId)
    .eq("livemode", livemode)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new BillingError(`Unknown Stripe price mapping: ${priceId}`);
  return data as {
    stripe_price_id: string;
    plan_key: "individual_course" | "monthly_member" | "annual_member";
    course_id: number | null;
    currency: string;
    unit_amount: number | null;
    recurring_interval: string | null;
    recurring_interval_count: number | null;
    livemode: boolean | null;
    active: boolean | null;
  };
}

async function recordCheckoutSession(supabase: SupabaseAdmin, stripe: Stripe, session: Stripe.Checkout.Session, event: Stripe.Event) {
  const userId = metadataUserId(session.metadata) ?? (isUuid(session.client_reference_id) ? session.client_reference_id : null);
  if (!userId) throw new BillingError(`Checkout session ${session.id} missing supabase_user_id`);
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  const { error } = await supabase.from("stripe_checkout_sessions").upsert({
    stripe_session_id: session.id,
    created_at: new Date(session.created * 1000).toISOString(),
    user_id: userId,
    stripe_customer_id: objectId(session.customer),
    stripe_price_id: lineItems.data[0]?.price?.id ?? null,
    status: session.status,
    payment_status: session.payment_status === "paid" ? "paid" : "pending",
    mode: session.mode,
    metadata: {
      ...session.metadata,
      activation_policy: session.mode === "payment" ? "annual_checkout_paid_required" : "invoice.paid_required",
      stripe_event_id: event.id,
    },
  }, { onConflict: "stripe_session_id" });
  if (error) throw error;

  // Payment Links can't inject metadata via URL — only `client_reference_id`.
  // Propagate the Supabase user id (and plan_key/course_id) onto the created
  // Subscription so downstream invoice.paid / customer.subscription.* handlers
  // can resolve the user without extra Stripe Dashboard configuration.
  const subscriptionId = objectId(session.subscription);
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const needsUser = !isUuid(sub.metadata?.supabase_user_id);
      const priceId = sub.items?.data?.[0]?.price?.id ?? lineItems.data[0]?.price?.id ?? null;
      let planKey: string | null = sub.metadata?.plan_key ?? null;
      let courseId: number | null = metadataCourseId(sub.metadata);
      if (priceId && (!planKey || (planKey === "individual_course" && !courseId))) {
        try {
          const mapping = await priceMapping(supabase, priceId, event.livemode);
          planKey = planKey ?? mapping.plan_key;
          if (mapping.plan_key === "individual_course" && !courseId) courseId = mapping.course_id;
        } catch { /* mapping unknown yet — skip enrichment */ }
      }
      if (needsUser || (planKey && !sub.metadata?.plan_key) || (courseId && !metadataCourseId(sub.metadata))) {
        const nextMetadata: Record<string, string> = { ...(sub.metadata ?? {}) };
        if (needsUser) nextMetadata.supabase_user_id = userId;
        if (planKey && !nextMetadata.plan_key) nextMetadata.plan_key = planKey;
        if (courseId && !nextMetadata.course_id) nextMetadata.course_id = String(courseId);
        await stripe.subscriptions.update(subscriptionId, { metadata: nextMetadata });
      }
    } catch (err) {
      console.error("[recordCheckoutSession] failed to enrich subscription metadata", err);
    }
  }
}

async function applyAnnualCheckoutPayment(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  if (session.mode !== "payment") throw new IgnoredEvent("annual_checkout_not_payment_mode");
  if (session.payment_status !== "paid") throw new IgnoredEvent("annual_checkout_not_paid");
  if (session.livemode !== event.livemode) throw new BillingError("annual_checkout_livemode_mismatch");

  // Payment Links carry the user via `client_reference_id`; fall back to it
  // when metadata.supabase_user_id is absent.
  const userId = metadataUserId(session.metadata)
    ?? (isUuid(session.client_reference_id) ? session.client_reference_id : null);
  if (!userId) throw new BillingError(`Annual Checkout session ${session.id} missing supabase_user_id`);

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  if (lineItems.data.length !== 1 || lineItems.data[0].quantity !== 1) {
    throw new BillingError(`Annual Checkout session ${session.id} must have one line item`);
  }

  const priceId = lineItems.data[0].price?.id ?? null;
  if (!priceId) throw new BillingError(`Annual Checkout session ${session.id} missing Price`);

  // Canonical validation against stripe_prices (no hardcoded Stripe Price ID).
  const mapping = await priceMapping(supabase, priceId, event.livemode);
  // Plan-key is inferred from the Price mapping (Payment Links don't set metadata).
  if (mapping.plan_key !== ANNUAL_MEMBER_CANONICAL.plan_key) throw new BillingError(`Annual Checkout session ${session.id} plan mismatch`);
  if (mapping.currency.toLowerCase() !== ANNUAL_MEMBER_CANONICAL.currency) throw new BillingError(`Annual Checkout session ${session.id} currency mismatch`);
  if (mapping.unit_amount !== ANNUAL_MEMBER_CANONICAL.unit_amount) throw new BillingError(`Annual Checkout session ${session.id} unit_amount mismatch`);
  if (mapping.recurring_interval !== null || mapping.recurring_interval_count !== null) {
    throw new BillingError(`Annual Checkout session ${session.id} must use a one-time Price`);
  }
  if (mapping.active !== true) throw new BillingError(`Annual Checkout session ${session.id} Price is not active`);
  if (mapping.livemode !== event.livemode) throw new BillingError("annual_price_livemode_mismatch");

  // Optional cross-validation: if STRIPE_LIVE_ANNUAL_PRICE_ID is configured for live mode, it must match.
  const expectedAnnualId = event.livemode ? (Deno.env.get("STRIPE_LIVE_ANNUAL_PRICE_ID") ?? "").trim() : "";
  if (expectedAnnualId && expectedAnnualId !== priceId) {
    throw new BillingError(`Annual Checkout session ${session.id} Price does not match STRIPE_LIVE_ANNUAL_PRICE_ID`);
  }

  if (typeof session.amount_total !== "number" || session.amount_total <= 0) {
    throw new BillingError(`Annual Checkout session ${session.id} has no positive paid amount`);
  }

  const customerId = objectId(session.customer);
  if (!customerId) throw new BillingError(`Annual Checkout session ${session.id} missing Customer`);
  const paymentIntentId = objectId(session.payment_intent);
  if (!paymentIntentId) throw new BillingError(`Annual Checkout session ${session.id} missing PaymentIntent`);

  const { data, error } = await supabase.rpc("internal_apply_stripe_annual_payment", {
    p_stripe_event_id: event.id,
    // Session creation time is stable across completed/async events and keeps
    // duplicate delivery from extending the original 12-month access window.
    p_stripe_event_created_at: new Date(session.created * 1000).toISOString(),
    p_user_id: userId,
    p_stripe_checkout_session_id: session.id,
    p_stripe_customer_id: customerId,
    p_stripe_price_id: mapping.stripe_price_id,
    p_stripe_payment_intent_id: paymentIntentId,
    p_amount: session.amount_total,
    p_currency: mapping.currency,
    p_livemode: event.livemode,
    p_metadata: {
      ...session.metadata,
      source_event_type: event.type,
      stripe_event_id: event.id,
      access_type: "annual_one_time",
    },
  });
  if (error) throw error;
  if ((data as { result?: string } | null)?.result === "processed_ignored_stale") {
    throw new IgnoredEvent("stale_annual_checkout_event", true);
  }
}

async function applySubscriptionState(supabase: SupabaseAdmin, event: Stripe.Event, subscription: Stripe.Subscription, statusOverride?: string) {
  const userId = metadataUserId(subscription.metadata)
    ?? await resolveUserIdForSubscription(supabase, subscription);
  if (!userId) throw new BillingError(`Subscription ${subscription.id} missing supabase_user_id`);
  const { error } = await supabase.rpc("internal_apply_stripe_subscription_state", {
    p_stripe_event_id: event.id,
    p_stripe_event_created_at: eventCreatedAt(event),
    p_user_id: userId,
    p_stripe_subscription_id: subscription.id,
    p_stripe_status: statusOverride ?? subscription.status,
    p_metadata: { source_event_type: event.type, stripe_status: subscription.status },
  });
  if (error) throw error;
}

async function applyInvoicePaid(supabase: SupabaseAdmin, stripe: Stripe, event: Stripe.Event, invoice: Stripe.Invoice) {
  if (invoice.status !== "paid") throw new BillingError(`Invoice ${invoice.id} is not paid`);
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) throw new IgnoredEvent("invoice_without_subscription");

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
  if (subscription.status !== "active") throw new BillingError(`Subscription ${subscription.id} is not active`);
  if (subscription.items.data.length !== 1) throw new BillingError(`Subscription ${subscription.id} must have one item`);

  const userId = metadataUserId(subscription.metadata)
    ?? await resolveUserIdForSubscription(supabase, subscription);
  if (!userId) throw new BillingError(`Subscription ${subscription.id} missing supabase_user_id`);
  const price = subscription.items.data[0].price;
  const invoicePriceId = invoiceLinePriceId(invoice);
  if (!invoicePriceId || invoicePriceId !== price.id) throw new BillingError(`Invoice ${invoice.id} Price mismatch`);

  const mapping = await priceMapping(supabase, price.id, event.livemode);
  if (mapping.currency !== invoice.currency) throw new BillingError(`Invoice ${invoice.id} currency mismatch`);
  if (mapping.livemode !== event.livemode) throw new BillingError(`Price livemode mismatch`);
  if (typeof invoice.amount_paid !== "number" || invoice.amount_paid <= 0) {
    throw new BillingError(`Invoice ${invoice.id} has no positive paid amount`);
  }

  const courseId = mapping.plan_key === "individual_course" ? mapping.course_id ?? metadataCourseId(subscription.metadata, price.metadata) : null;
  if (mapping.plan_key === "individual_course") {
    if (!courseId) throw new BillingError(`Individual Course subscription ${subscription.id} missing course_id`);
    const { data: course, error: courseError } = await supabase.from("courses").select("id").eq("id", courseId).eq("status", "published").maybeSingle();
    if (courseError) throw courseError;
    if (!course) throw new BillingError(`Course ${courseId} is not purchasable`);
  }

  const period = subscriptionPeriod(subscription);
  const { data, error } = await supabase.rpc("internal_apply_stripe_invoice_paid", {
    p_stripe_event_id: event.id,
    p_stripe_event_created_at: eventCreatedAt(event),
    p_user_id: userId,
    p_plan_key: mapping.plan_key,
    p_course_id: courseId,
    p_stripe_subscription_id: subscription.id,
    p_stripe_customer_id: objectId(subscription.customer),
    p_stripe_price_id: mapping.stripe_price_id,
    p_subscription_status: subscription.status,
    p_current_period_start: period.start,
    p_current_period_end: period.end,
    p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    p_stripe_invoice_id: invoice.id,
    p_stripe_payment_intent_id: invoicePaymentIntentId(invoice),
    p_amount: invoice.amount_paid,
    p_currency: invoice.currency,
    p_livemode: event.livemode,
    p_metadata: { source_event_type: event.type, stripe_event_id: event.id, stripe_invoice_id: invoice.id, plan_key: mapping.plan_key, course_id: courseId },
  });
  if (error) throw error;
  if ((data as { result?: string } | null)?.result === "processed_ignored_stale") throw new IgnoredEvent("stale_event", true);
}

async function paymentForCharge(supabase: SupabaseAdmin, stripe: Stripe, chargeId: string) {
  const charge = await stripe.charges.retrieve(chargeId);
  const paymentIntentId = objectId(charge.payment_intent);

  const query = supabase
    .from("stripe_payments")
    .select("stripe_invoice_id, stripe_subscription_id, stripe_payment_intent_id")
    .eq("stripe_charge_id", charge.id);
  let result = await query.maybeSingle();

  if (!result.data && paymentIntentId) {
    result = await supabase
      .from("stripe_payments")
      .select("stripe_invoice_id, stripe_subscription_id, stripe_payment_intent_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
  }

  if (result.error) throw result.error;
  return { charge, payment: result.data, paymentIntentId };
}

async function revokeByCharge(supabase: SupabaseAdmin, stripe: Stripe, event: Stripe.Event, chargeId: string | null, reason: string) {
  if (!chargeId) throw new IgnoredEvent(`${reason}_without_charge`);
  const { charge, payment, paymentIntentId } = await paymentForCharge(supabase, stripe, chargeId);
  const subscriptionId = payment?.stripe_subscription_id ?? null;
  if (!subscriptionId) throw new IgnoredEvent(`${reason}_without_subscription`);
  const { error } = await supabase.rpc("internal_apply_stripe_access_revocation", {
    p_stripe_event_id: event.id,
    p_stripe_event_created_at: eventCreatedAt(event),
    p_stripe_subscription_id: subscriptionId,
    p_reason: reason,
    p_metadata: {
      source_event_type: event.type,
      charge_id: charge.id,
      payment_intent_id: paymentIntentId,
      invoice_id: payment?.stripe_invoice_id ?? null,
    },
  });
  if (error) throw error;
}

export async function processBillingEvent(supabase: SupabaseAdmin, stripe: Stripe, event: Stripe.Event) {
  if (event.livemode !== expectedLivemode()) throw new BillingError("livemode_mismatch", "failed_permanent", "livemode_mismatch");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await recordCheckoutSession(supabase, stripe, session, event);
      if (session.mode === "payment") {
        // Route one-time payments (annual) by inspecting the Price mapping —
        // Payment Links can't inject metadata.plan_key from the URL.
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = items.data[0]?.price?.id ?? null;
        if (priceId) {
          try {
            const mapping = await priceMapping(supabase, priceId, event.livemode);
            if (mapping.plan_key === "annual_member") {
              await applyAnnualCheckoutPayment(supabase, stripe, event, session);
              return;
            }
          } catch { /* unknown price — fall through to ignored */ }
        }
      }
      throw new IgnoredEvent("subscription_checkout_records_only_invoice_paid_activates");
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      await recordCheckoutSession(supabase, stripe, session, event);
      await applyAnnualCheckoutPayment(supabase, stripe, event, session);
      return;
    }
    case "checkout.session.async_payment_failed":
      await recordCheckoutSession(supabase, stripe, event.data.object as Stripe.Checkout.Session, event);
      throw new IgnoredEvent("annual_async_payment_failed_never_activates");
    case "customer.subscription.created":
      throw new IgnoredEvent("subscription_created_never_activates");
    case "customer.subscription.updated":
      // This RPC records subscription state and may revoke access. It never
      // activates or reactivates memberships or course entitlements.
      await applySubscriptionState(supabase, event, event.data.object as Stripe.Subscription);
      return;
    case "customer.subscription.deleted":
      await applySubscriptionState(supabase, event, event.data.object as Stripe.Subscription, "canceled");
      return;
    case "invoice.paid":
      await applyInvoicePaid(supabase, stripe, event, event.data.object as Stripe.Invoice);
      return;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) throw new IgnoredEvent("payment_failed_without_subscription");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await applySubscriptionState(supabase, event, subscription, "past_due");
      return;
    }
    case "charge.refunded":
      await revokeByCharge(supabase, stripe, event, (event.data.object as Stripe.Charge).id, "refund");
      return;
    case "charge.dispute.created":
      await revokeByCharge(supabase, stripe, event, objectId((event.data.object as Stripe.Dispute).charge), "dispute");
      return;
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      if (dispute.status !== "won") throw new IgnoredEvent("dispute_closed_not_won");
      const chargeId = objectId(dispute.charge);
      if (!chargeId) throw new IgnoredEvent("won_dispute_without_charge");
      const { payment } = await paymentForCharge(supabase, stripe, chargeId);
      const invoiceId = payment?.stripe_invoice_id ?? null;
      if (!invoiceId) throw new IgnoredEvent("won_dispute_without_invoice");
      const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ["lines.data.pricing.price_details.price"] });
      await applyInvoicePaid(supabase, stripe, event, invoice);
      return;
    }
    default:
      throw new IgnoredEvent(`unhandled_${event.type}`);
  }
}

export async function finalizeBillingEvent(supabase: SupabaseAdmin, event: Stripe.Event, work: () => Promise<void>): Promise<TerminalStatus> {
  try {
    await work();
    await markWebhookEvent(supabase, event.id, "processed");
    return "processed";
  } catch (error) {
    if (error instanceof BillingError) {
      await markWebhookEvent(supabase, event.id, error.status, error.status.startsWith("failed") ? error.message : null, error.reason);
      return error.status;
    }
    const message = error instanceof Error ? error.message : String(error);
    await markWebhookEvent(supabase, event.id, "failed_retryable", message);
    return "failed_retryable";
  }
}

