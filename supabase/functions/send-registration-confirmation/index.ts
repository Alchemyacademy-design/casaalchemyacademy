// send-registration-confirmation
//
// When a signed-in student registers for an event or live workshop, this
// function sends them a confirmation + reminder email in English via Gmail
// (Lovable connector gateway, sent from Lorena's inbox), with automatic
// fallback to Resend if Gmail is unavailable.
//
// The user-facing Google Calendar OAuth flow has been removed — no calendar
// invites are sent from here. The email is purely informational and includes
// event title, start time (Australia/Sydney) and any relevant link.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildGmailRawMessage } from "../_shared/gmail-message.ts";

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL =
  Deno.env.get("EVENT_REMINDER_FROM_EMAIL") ??
  Deno.env.get("LEAD_MAGNET_FROM_EMAIL") ??
  "Casa Alchemy <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_FRONTEND_URL") ?? "https://casaalchemyacademy.com";
const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function formatSydney(iso: string | null | undefined): string {
  if (!iso) return "TBA";
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso)) + " (Sydney)";
  } catch {
    return iso;
  }
}

type EmailKind = "event" | "live_workshop";

async function sendReminderEmail(input: {
  to: string;
  name: string;
  kind: EmailKind;
  title: string;
  startsAtIso: string | null;
  location: string | null;
  link: string | null;
}): Promise<"gmail" | "resend" | "failed"> {
  const firstName = (input.name || "").trim().split(/\s+/)[0] || "there";
  const kindLabel = input.kind === "live_workshop" ? "workshop" : "event";
  const subject = `You're in — ${input.title}`;
  const when = formatSydney(input.startsAtIso);
  const whereBlock = input.location
    ? `<p style="font-size:15px;line-height:1.6;margin:4px 0;"><strong>Where:</strong> ${input.location}</p>`
    : "";
  const linkBlock = input.link
    ? `<p style="margin:24px 0;">
         <a href="${input.link}" style="display:inline-block;background:#b8934a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Open ${kindLabel} link</a>
       </p>`
    : "";
  const linkTextLine = input.link ? `Link: ${input.link}\n\n` : "";

  const html = `
    <div style="font-family:'Manrope',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2a2a;">
      <h1 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">See you soon, ${firstName}.</h1>
      <p style="font-size:15px;line-height:1.6;">Your spot for <strong>${input.title}</strong> is confirmed. Consider this your reminder — save the date and we'll see you there.</p>
      <div style="background:#faf6ef;border:1px solid #e9dec4;border-radius:6px;padding:16px 20px;margin:20px 0;">
        <p style="font-size:15px;line-height:1.6;margin:4px 0;"><strong>What:</strong> ${input.title}</p>
        <p style="font-size:15px;line-height:1.6;margin:4px 0;"><strong>When:</strong> ${when}</p>
        ${whereBlock}
      </div>
      ${linkBlock}
      <p style="font-size:14px;line-height:1.6;color:#666;">You can review all your registered ${kindLabel}s any time from your Alchemy Academy dashboard: <a href="${APP_URL}/dashboard">${APP_URL}/dashboard</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <p style="font-size:13px;color:#888;">Casa Alchemy Studio · With love from Lorena and the team.</p>
    </div>`;
  const plaintext =
    `See you soon, ${firstName}.\n\n` +
    `Your spot for "${input.title}" is confirmed.\n\n` +
    `When: ${when}\n` +
    (input.location ? `Where: ${input.location}\n` : "") +
    `\n${linkTextLine}` +
    `Manage your registered ${kindLabel}s from your dashboard: ${APP_URL}/dashboard\n\n` +
    `Casa Alchemy Studio`;

  if (LOVABLE_API_KEY && GOOGLE_MAIL_API_KEY) {
    try {
      const raw = buildGmailRawMessage({
        from: FROM_EMAIL,
        to: input.to,
        subject,
        html,
        plaintext,
      });
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
        return "gmail";
      }
      const body = await res.text();
      console.warn(`gmail send failed [${res.status}]: ${body} — falling back to Resend`);
    } catch (e) {
      console.warn("gmail send threw, falling back to Resend:", e);
    }
  }

  if (!RESEND_API_KEY) {
    console.warn("resend: RESEND_API_KEY not configured, no fallback available");
    return "failed";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [input.to],
      subject,
      html,
      text: plaintext,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`resend send failed [${res.status}]: ${body}`);
    return "failed";
  }
  await res.text();
  return "resend";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const authed = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await authed.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
    const userEmail = (userData.user.email ?? "").trim().toLowerCase();
    if (!userEmail) return json({ error: "email_missing" }, 400);

    const body = (await req.json().catch(() => null)) as
      | { target_type?: EmailKind; target_id?: number }
      | null;
    const targetType = body?.target_type;
    const targetId = Number(body?.target_id);
    if ((targetType !== "event" && targetType !== "live_workshop") || !Number.isFinite(targetId)) {
      return json({ error: "invalid_request" }, 400);
    }

    const table = targetType === "event" ? "events" : "live_workshops";
    const cols = targetType === "event"
      ? "id, title, starts_at, location, external_url"
      : "id, title, starts_at, meeting_url";
    const { data: target, error: tErr } = await admin
      .from(table)
      .select(cols)
      .eq("id", targetId)
      .maybeSingle();
    if (tErr) return json({ error: "db_error", details: tErr.message }, 500);
    if (!target) return json({ error: "target_not_found" }, 404);

    const t = target as Record<string, unknown>;
    const displayName =
      (userData.user.user_metadata?.full_name as string | undefined) ??
      (userData.user.user_metadata?.name as string | undefined) ??
      userEmail.split("@")[0];

    const provider = await sendReminderEmail({
      to: userEmail,
      name: displayName,
      kind: targetType,
      title: String(t.title ?? "Alchemy Academy"),
      startsAtIso: (t.starts_at as string | null) ?? null,
      location: (t.location as string | null) ?? null,
      link: (t.meeting_url as string | null) ?? (t.external_url as string | null) ?? null,
    });

    return json({
      ok: provider !== "failed",
      provider,
      masked_email: maskEmail(userEmail),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "internal", details: msg }, 500);
  }
});