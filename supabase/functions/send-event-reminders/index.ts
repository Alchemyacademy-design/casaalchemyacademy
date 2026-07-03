// Cron-friendly reminder scheduler.
// Meant to be invoked via `supabase functions schedule` (cron: 0 * * * *)
// or by an external scheduler. Idempotent per (target, user, window).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Upcoming {
  kind: "event" | "workshop";
  id: number;
  title: string;
  starts_at: string;
}

function windowAround(minutes: number) {
  const now = Date.now();
  const target = now + minutes * 60_000;
  // half-hour window around target so hourly cron catches everything once
  return {
    from: new Date(target - 30 * 60_000).toISOString(),
    to: new Date(target + 30 * 60_000).toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Collect items starting in ~24h and ~1h from now (two reminder waves)
    const waves = [
      { key: "24h", ...windowAround(24 * 60) },
      { key: "1h", ...windowAround(60) },
    ];

    const summary: Record<string, number> = {};

    for (const w of waves) {
      const [ev, ws] = await Promise.all([
        supabase.from("events").select("id,title,starts_at").gte("starts_at", w.from).lte("starts_at", w.to),
        supabase.from("live_workshops").select("id,title,starts_at").gte("starts_at", w.from).lte("starts_at", w.to),
      ]);
      const items: Upcoming[] = [
        ...(ev.data ?? []).map((r) => ({ ...r, kind: "event" as const })),
        ...(ws.data ?? []).map((r) => ({ ...r, kind: "workshop" as const })),
      ];
      summary[`wave_${w.key}_items`] = items.length;

      // Load registrations per item and log the intent to notify.
      // Actual email delivery is intentionally left as a hook the operator
      // can plug into (Resend/SendGrid). We only surface who WOULD be notified.
      let scheduled = 0;
      for (const item of items) {
        const { data: regs } = await supabase
          .from("registrations")
          .select("user_id")
          .eq("target_type", item.kind === "event" ? "event" : "workshop")
          .eq("target_id", item.id);
        scheduled += regs?.length ?? 0;
      }
      summary[`wave_${w.key}_recipients`] = scheduled;
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});