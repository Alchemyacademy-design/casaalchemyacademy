// Cron-friendly reminder scheduler for events and live workshops.
// Meant to be invoked via `supabase functions schedule` (cron: 0 * * * *)
// or by an external scheduler.
//
// Recipients come from BOTH:
//   1. public.registrations  (signed-in members, email resolved via profiles)
//   2. public.leads          (source='live_workshop', metadata.workshop_id)
//
// Idempotency: every successful send writes a row into
// public.workshop_reminders_sent (live_workshop_id, recipient_email, wave).
// A matching row is checked before each send so re-running the cron in the
// same window never double-mails anyone.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { buildGmailRawMessage } from "../_shared/gmail-message.ts";
import { publicUrl } from "../_shared/site-url.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
const FROM_EMAIL = Deno.env.get("LEAD_MAGNET_FROM_EMAIL") ?? "Casa Alchemy <onboarding@resend.dev>";
const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

interface Upcoming {
  kind: "event" | "workshop";
  id: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  meeting_url?: string | null;
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

function formatWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt).toLocaleString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  if (!endsAt) return start;
  const end = new Date(endsAt).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  return `${start} – ${end}`;
}

async function deliverEmail(input: {
  to: string;
  subject: string;
  html: string;
  plaintext: string;
}): Promise<boolean> {
  const { to, subject, html, plaintext } = input;
  if (LOVABLE_API_KEY && GOOGLE_MAIL_API_KEY) {
    try {
      const raw = buildGmailRawMessage({ from: FROM_EMAIL, to, subject, html, plaintext });
      const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      if (res.ok) {
        await res.text();
        return true;
      }
      console.warn(`gmail send failed [${res.status}]: ${await res.text()} — falling back to Resend`);
    } catch (e) {
      console.warn("gmail send threw, falling back to Resend:", e);
    }
  }

  if (!RESEND_API_KEY) {
    console.warn("resend: RESEND_API_KEY not configured, cannot send reminder");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, text: plaintext }),
  });
  if (!res.ok) {
    console.warn(`resend send failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  await res.text();
  return true;
}

function reminderBody(item: Upcoming, wave: string) {
  const when = formatWhen(item.starts_at, item.ends_at);
  const lead = wave === "1h" ? "starts in about an hour" : "is tomorrow";
  const subject = `Reminder: ${item.title} ${lead}`;
  const joinLine = item.meeting_url
    ? `<p style="margin:24px 0;"><a href="${item.meeting_url}" style="display:inline-block;background:#b8934a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Join the session</a></p>`
    : `<p style="font-size:15px;line-height:1.6;">We'll send the private class link by email shortly before we start.</p>`;
  const html = `
    <div style="font-family:'Manrope',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2a2a;">
      <h1 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">${item.title} ${lead}.</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px;"><strong>When:</strong> ${when}</p>
      ${joinLine}
      <p style="font-size:14px;line-height:1.6;color:#666;">See everything coming up: <a href="${publicUrl("/events")}">${publicUrl("/events")}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <p style="font-size:13px;color:#888;">Casa Alchemy Studio · With love from Lorena and the team.</p>
    </div>`;
  const plaintext = `${item.title} ${lead}.\n\nWhen: ${when}\n${item.meeting_url ? `Join: ${item.meeting_url}\n` : "We'll send the private class link by email shortly before we start.\n"}\nCasa Alchemy Studio`;
  return { subject, html, plaintext };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const waves = [
      { key: "24h", ...windowAround(24 * 60) },
      { key: "1h", ...windowAround(60) },
    ];

    const summary: Record<string, number> = {};

    for (const w of waves) {
      const [ev, ws] = await Promise.all([
        supabase.from("events").select("id,title,starts_at,ends_at").gte("starts_at", w.from).lte("starts_at", w.to),
        supabase
          .from("live_workshops")
          .select("id,title,starts_at,ends_at,meeting_url")
          .gte("starts_at", w.from)
          .lte("starts_at", w.to),
      ]);
      const items: Upcoming[] = [
        ...(ev.data ?? []).map((r) => ({ ...r, kind: "event" as const })),
        ...(ws.data ?? []).map((r) => ({ ...r, kind: "workshop" as const })),
      ];
      summary[`wave_${w.key}_items`] = items.length;

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const item of items) {
        const recipients = new Set<string>();

        // 1. Member registrations (email resolved through profiles).
        const regQuery = supabase
          .from("registrations")
          .select("user_id")
          .neq("status", "cancelled");
        const { data: regs } = item.kind === "event"
          ? await regQuery.eq("event_id", item.id)
          : await regQuery.eq("live_workshop_id", item.id);
        const userIds = (regs ?? []).map((r) => r.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("email")
            .in("id", userIds);
          for (const p of profs ?? []) {
            if (p.email) recipients.add(p.email.toLowerCase());
          }
        }

        // 2. Public leads captured on the "Ask the Expert LIVE" landing page.
        if (item.kind === "workshop") {
          const { data: leads } = await supabase
            .from("leads")
            .select("email,metadata")
            .eq("source", "live_workshop")
            .contains("metadata", { workshop_id: item.id });
          for (const l of leads ?? []) {
            if (l.email) recipients.add(l.email.toLowerCase());
          }
        }

        if (recipients.size === 0) continue;
        const { subject, html, plaintext } = reminderBody(item, w.key);

        for (const to of recipients) {
          // Dedupe ledger is workshop-scoped; events reuse the same table with
          // their own id namespace only when they are workshops.
          const canLedger = item.kind === "workshop";
          if (canLedger) {
            const { data: already } = await supabase
              .from("workshop_reminders_sent")
              .select("id")
              .eq("live_workshop_id", item.id)
              .eq("recipient_email", to)
              .eq("wave", w.key)
              .maybeSingle();
            if (already) { skipped++; continue; }
          }

          const ok = await deliverEmail({ to, subject, html, plaintext });
          if (!ok) { failed++; continue; }
          sent++;

          if (canLedger) {
            const { error: ledgerErr } = await supabase
              .from("workshop_reminders_sent")
              .insert({ live_workshop_id: item.id, recipient_email: to, wave: w.key });
            if (ledgerErr) console.warn("reminder ledger insert failed:", ledgerErr);
          }
        }
      }

      summary[`wave_${w.key}_sent`] = sent;
      summary[`wave_${w.key}_skipped`] = skipped;
      summary[`wave_${w.key}_failed`] = failed;
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("send-event-reminders failed:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
