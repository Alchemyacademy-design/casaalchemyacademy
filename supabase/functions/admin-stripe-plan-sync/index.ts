// Admin-only helper: query and create Stripe Products/Prices for a given plan_key.
// Frontend uses this to pre-check duplicates and auto-reconcile out-of-sync plans.
// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia" as any,
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userRes, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userRes.user) return json({ error: "unauthorized" }, 401);

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "check_plan_key") {
      const plan_key = String(body.plan_key ?? "").trim();
      if (!plan_key) return json({ error: "plan_key required" }, 400);

      const q = `metadata['plan_key']:'${plan_key.replace(/'/g, "\\'")}'`;
      const [productSearch, priceSearch] = await Promise.all([
        stripe.products.search({ query: q, limit: 10 }),
        stripe.prices.search({ query: `${q} AND active:'true'`, limit: 10 }),
      ]);

      // Include prices whose product carries the metadata (search of prices by product-metadata isn't native).
      const seen = new Set(priceSearch.data.map((p) => p.id));
      const extras: Stripe.Price[] = [];
      for (const prod of productSearch.data) {
        const pr = await stripe.prices.list({ product: prod.id, active: true, limit: 10 });
        for (const p of pr.data) {
          if (!seen.has(p.id)) { seen.add(p.id); extras.push(p); }
        }
      }

      return json({
        products: productSearch.data.map((p) => ({ id: p.id, name: p.name, livemode: p.livemode, active: p.active })),
        prices: [...priceSearch.data, ...extras].map((p) => ({
          id: p.id,
          product: typeof p.product === "string" ? p.product : p.product.id,
          unit_amount: p.unit_amount,
          currency: p.currency,
          recurring: p.recurring
            ? { interval: p.recurring.interval, interval_count: p.recurring.interval_count }
            : null,
          livemode: p.livemode,
          active: p.active,
        })),
      });
    }

    if (action === "reconcile_plan") {
      const plan_key = String(body.plan_key ?? "").trim();
      const name = String(body.name ?? "").trim() || plan_key;
      const description = body.description ? String(body.description) : undefined;
      const unit_amount = Number(body.unit_amount);
      const currency = String(body.currency ?? "aud").toLowerCase();
      const interval = String(body.interval ?? "month");
      const interval_count = Math.max(1, Number(body.interval_count ?? 1));

      if (!plan_key) return json({ error: "plan_key required" }, 400);
      if (!Number.isFinite(unit_amount) || unit_amount <= 0) {
        return json({ error: "unit_amount must be a positive integer (cents)" }, 400);
      }
      if (!["day", "week", "month", "year"].includes(interval)) {
        return json({ error: "invalid interval" }, 400);
      }

      const q = `metadata['plan_key']:'${plan_key.replace(/'/g, "\\'")}' AND active:'true'`;
      const found = await stripe.products.search({ query: q, limit: 1 });
      let product = found.data[0];
      if (!product) {
        product = await stripe.products.create({
          name,
          description,
          metadata: { plan_key },
        });
      }

      const price = await stripe.prices.create({
        product: product.id,
        currency,
        unit_amount: Math.round(unit_amount),
        recurring: { interval: interval as any, interval_count },
        metadata: { plan_key },
      });

      return json({
        product_id: product.id,
        price_id: price.id,
        livemode: price.livemode,
        currency: price.currency,
        unit_amount: price.unit_amount,
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});