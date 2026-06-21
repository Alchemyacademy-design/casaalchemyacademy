import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22.2.1";
import { withSupabase } from "npm:@supabase/server@1.1.0";
import type { Database } from "../../../shared/supabase.types.ts";
import {
  claimWebhookEvent,
  expectedLivemode,
  finalizeBillingEvent,
  jsonResponse,
  MAX_RECOVERY_BATCH_SIZE,
  processBillingEvent,
  stripeClient,
} from "../_shared/billing-core.ts";

const ANNUAL_PRICE_ID = "price_1TZhtrK9GJLTk49TgcjXU3VU";

function objectId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function processRecoveredAnnualCheckout(supabase: SupabaseAdmin, stripe: Stripe, event: Stripe.Event) {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "checkout.session.async_payment_failed"
  ) return false;

  const session = event.data.object as Stripe.Checkout.Session;
  const isAnnual = session.mode === "payment" && session.metadata?.plan_key === "annual_member";
  if (!isAnnual) return false;

  if (event.type === "checkout.session.async_payment_failed") {
    const { error } = await supabase.from("stripe_checkout_sessions").upsert({
      stripe_session_id: session.id,
      user_id: isUuid(session.metadata?.supabase_user_id) ? session.metadata?.supabase_user_id : null,
      stripe_customer_id: objectId(session.customer),
      stripe_price_id: session.metadata?.stripe_price_id ?? ANNUAL_PRICE_ID,
      status: session.status,
      payment_status: "failed",
      mode: session.mode,
      metadata: { ...session.metadata, stripe_event_id: event.id, source_event_type: event.type },
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_session_id" });
    if (error) throw error;
    return true;
  }

  if (session.payment_status !== "paid") return false;
  if (event.livemode !== expectedLivemode()) throw new Error("livemode_mismatch");

  const userId = isUuid(session.metadata?.supabase_user_id)
    ? session.metadata?.supabase_user_id
    : isUuid(session.client_reference_id)
      ? session.client_reference_id
      : null;
  if (!userId) throw new Error("annual_checkout_missing_user_id");

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  if (lineItems.data.length !== 1) throw new Error("annual_checkout_requires_one_line_item");
  const stripePriceId = lineItems.data[0]?.price?.id ?? null;
  if (stripePriceId !== ANNUAL_PRICE_ID) throw new Error("annual_price_mismatch");

  const { data: mapping, error: mappingError } = await supabase
    .from("stripe_prices")
    .select("stripe_price_id, plan_key, course_id, currency, recurring_interval, recurring_interval_count, livemode")
    .eq("stripe_price_id", stripePriceId)
    .eq("plan_key", "annual_member")
    .eq("livemode", event.livemode)
    .is("course_id", null)
    .maybeSingle();
  if (mappingError) throw mappingError;
  if (!mapping) throw new Error("annual_price_mapping_missing");
  if (mapping.currency !== "aud") throw new Error("annual_currency_mismatch");
  if (mapping.recurring_interval !== null || mapping.recurring_interval_count !== null) {
    throw new Error("annual_price_must_be_one_time");
  }

  const amount = session.amount_total;
  if (typeof amount !== "number" || amount <= 0) throw new Error("annual_amount_not_positive");
  if (session.currency !== "aud") throw new Error("annual_session_currency_mismatch");

  const { error } = await supabase.rpc("internal_apply_stripe_annual_payment", {
    p_stripe_event_id: event.id,
    p_stripe_event_created_at: new Date(event.created * 1000).toISOString(),
    p_user_id: userId,
    p_stripe_checkout_session_id: session.id,
    p_stripe_customer_id: objectId(session.customer),
    p_stripe_price_id: stripePriceId,
    p_stripe_payment_intent_id: objectId(session.payment_intent),
    p_amount: amount,
    p_currency: session.currency,
    p_livemode: event.livemode,
    p_metadata: { ...session.metadata, stripe_event_id: event.id, source_event_type: event.type, access_months: 12 },
  });
  if (error) throw error;
  return true;
}

const handler = withSupabase<Database>({ auth: "secret:billing", cors: false }, async (request, ctx) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabase = ctx.supabaseAdmin;
  const stripe = stripeClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("stripe_webhook_events")
    .select("stripe_event_id, payload")
    .or(`status.eq.failed_retryable,and(status.eq.processing,processing_lease_expires_at.lt.${now})`)
    .order("created_at", { ascending: true })
    .limit(MAX_RECOVERY_BATCH_SIZE);

  if (error) throw error;

  const counters = { claimed: 0, processed: 0, retryable: 0, permanent: 0, ignored: 0 };

  for (const row of rows ?? []) {
    const event = row.payload as unknown as Stripe.Event;
    const claim = await claimWebhookEvent(supabase, event);

    if (claim.result !== "claimed" && claim.result !== "reclaimed_after_timeout") continue;
    counters.claimed += 1;

    const status = await finalizeBillingEvent(supabase, event, async () => {
      const handled = await processRecoveredAnnualCheckout(supabase, stripe, event);
      if (!handled) await processBillingEvent(supabase, stripe, event);
    });

    if (status === "processed") counters.processed += 1;
    else if (status === "failed_retryable") counters.retryable += 1;
    else if (status === "failed_permanent") counters.permanent += 1;
    else counters.ignored += 1;
  }

  return jsonResponse(counters);
});

Deno.serve(handler);
