import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22.2.1";
import { withSupabase } from "npm:@supabase/server@1.1.0";
import type { Database } from "../../../shared/supabase.types.ts";
import {
  claimWebhookEvent,
  expectedLivemode,
  finalizeBillingEvent,
  jsonResponse,
  processBillingEvent,
  stripeClient,
  stripeWebhookSecret,
  supabaseAdmin,
} from "../_shared/billing-core.ts";

// The webhook is intentionally thin: verify signature, claim idempotently,
// delegate to the shared processor in billing-core.ts, finalize status.
// All event-specific logic (including annual one-time checkout activation)
// lives in processBillingEvent so it cannot drift between functions.
const handler = withSupabase<Database>({ auth: "none", cors: false }, async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return jsonResponse({ error: "Missing Stripe-Signature" }, 400);

  const stripe = stripeClient();
  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSecret(),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return jsonResponse({ error: "Invalid Stripe signature" }, 400);
  }

  // Reject cross-mode events even if the signature happens to verify
  // (defense in depth against test-mode webhooks hitting a live endpoint).
  if (event.livemode !== expectedLivemode()) {
    return jsonResponse({ error: "livemode_mismatch" }, 400);
  }

  const supabase = supabaseAdmin();
  const claim = await claimWebhookEvent(supabase, event);

  if (claim.result === "already_processed" || claim.result === "retry_exhausted") {
    return jsonResponse({ received: true, status: claim.result });
  }

  if (claim.result === "already_processing") {
    return jsonResponse({ received: true, status: "already_processing" });
  }

  const status = await finalizeBillingEvent(supabase, event, async () => {
    await processBillingEvent(supabase, stripe, event);
  });

  return jsonResponse({ received: status !== "failed_retryable", status }, status === "failed_retryable" ? 500 : 200);
});

Deno.serve(handler);
