// Admin-only edge function for safe Stripe subscription management.
// Actions: cancel_at_period_end, cancel_immediately, resync_subscription.
// Calls Stripe API; relies on stripe-webhook to sync the local database.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Stripe from "npm:stripe@14.25.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "cancel_at_period_end" | "cancel_immediately" | "resync_subscription";

interface Payload {
  action: Action;
  target_user_id: string;
  stripe_subscription_id: string;
  confirmation_email?: string;
  reason?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) return json({ error: "stripe_not_configured" }, 500);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: claimsErr } = await userClient.auth.getUser(token);
  const claims = authData?.user ? { claims: { sub: authData.user.id } } : null;
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const actorId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: actorRoles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", actorId);
  const isAdmin = (actorRoles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body.action || !body.target_user_id || !body.stripe_subscription_id) {
    return json({ error: "invalid_payload" }, 400);
  }

  // Confirm the subscription belongs to the target user.
  const { data: localSub } = await admin
    .from("stripe_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", body.stripe_subscription_id)
    .maybeSingle();
  if (!localSub || localSub.user_id !== body.target_user_id) {
    return json({ error: "subscription_not_found_for_user" }, 404);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  const audit = async (action: string, before: unknown, after: unknown) => {
    await admin.from("admin_access_audit_log").insert({
      actor_user_id: actorId,
      target_user_id: body.target_user_id,
      action,
      entity_type: "stripe_subscription",
      entity_id: body.stripe_subscription_id,
      reason: body.reason ?? null,
      before_state: before ?? null,
      after_state: after ?? null,
    });
  };

  try {
    if (body.action === "cancel_at_period_end") {
      const updated = await stripe.subscriptions.update(
        body.stripe_subscription_id,
        { cancel_at_period_end: true },
      );
      await audit("stripe_cancel_at_period_end", localSub, {
        cancel_at_period_end: updated.cancel_at_period_end,
        current_period_end: updated.current_period_end,
        status: updated.status,
      });
      return json({
        ok: true,
        message:
          "The subscription will remain active until the end of the current billing period.",
        cancel_at_period_end: updated.cancel_at_period_end,
        current_period_end: updated.current_period_end,
      });
    }

    if (body.action === "cancel_immediately") {
      // Strong confirmation: caller must echo the target user email.
      const { data: targetUser } = await admin.auth.admin.getUserById(
        body.target_user_id,
      );
      const targetEmail = (targetUser?.user?.email ?? "").trim().toLowerCase();
      const provided = (body.confirmation_email ?? "").trim().toLowerCase();
      if (!provided || provided !== targetEmail) {
        return json({ error: "confirmation_email_mismatch" }, 400);
      }
      const canceled = await stripe.subscriptions.cancel(
        body.stripe_subscription_id,
      );
      await audit("stripe_cancel_immediately", localSub, {
        status: canceled.status,
        canceled_at: canceled.canceled_at,
      });
      return json({ ok: true, status: canceled.status });
    }

    if (body.action === "resync_subscription") {
      const remote = await stripe.subscriptions.retrieve(
        body.stripe_subscription_id,
      );
      const item = remote.items?.data?.[0];
      const update = {
        status: remote.status,
        cancel_at_period_end: remote.cancel_at_period_end,
        current_period_start: item?.current_period_start
          ? new Date(item.current_period_start * 1000).toISOString()
          : null,
        current_period_end: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null,
        last_synced_at: new Date().toISOString(),
      };
      const { data: after, error } = await admin
        .from("stripe_subscriptions")
        .update(update)
        .eq("stripe_subscription_id", body.stripe_subscription_id)
        .select()
        .maybeSingle();
      if (error) throw error;
      await audit("stripe_resync_subscription", localSub, after);
      return json({ ok: true, data: after });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "stripe_action_failed", message }, 500);
  }
});
