// Post-payment welcome email. Triggered from billing-core.ts after access is
// granted by the Stripe webhook. Sends a congratulations + first-access guide,
// with an activation link generated via Supabase Admin API (generateLink) for
// brand-new accounts, or a plain /login link for accounts that have signed
// in before. Guarded by metadata.welcome_email on the stripe_checkout_sessions
// (annual) or stripe_subscriptions (monthly) row to avoid double-sends on
// webhook retries or overlapping event deliveries.
//
// Delivery: Gmail via the Lovable connector gateway first, Resend as fallback
// — same pattern used by capture-lead (Fase 6). Never throws; failures are
// logged and returned as "failed" so they don't roll back access grants.

import type { SupabaseAdmin } from "./billing-core.ts";

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL =
  Deno.env.get("WELCOME_EMAIL_FROM")
  ?? Deno.env.get("LEAD_MAGNET_FROM_EMAIL")
  ?? "Casa Alchemy Academy <onboarding@resend.dev>";
const SITE_URL = (
  Deno.env.get("APP_FRONTEND_URL")
  ?? Deno.env.get("PUBLIC_SITE_URL")
  ?? "https://casaalchemyacademy.com"
).replace(/\/$/, "");

export type WelcomeProvider = "gmail" | "resend" | "failed" | "skipped";

const PLAN_LABELS: Record<string, string> = {
  annual_member: "Annual Member",
  monthly_member: "Monthly Member",
  individual_course: "Course Access",
};

function planLabel(planKey: string | null | undefined): string {
  if (!planKey) return "Alchemy Academy";
  return PLAN_LABELS[planKey] ?? "Alchemy Academy";
}

type AdminAuth = {
  getUserById: (id: string) => Promise<{
    data: { user: { email?: string | null; last_sign_in_at?: string | null } | null } | null;
    error: unknown;
  }>;
  generateLink: (args: {
    type: string;
    email: string;
    options?: { redirectTo?: string };
  }) => Promise<{
    data: { properties?: { action_link?: string } | null } | null;
    error: unknown;
  }>;
};

function adminAuth(supabase: SupabaseAdmin): AdminAuth {
  return (supabase as unknown as { auth: { admin: AdminAuth } }).auth.admin;
}

async function getUserForWelcome(
  supabase: SupabaseAdmin,
  userId: string,
  fallbackEmail: string | null,
): Promise<{ email: string; hasSignedIn: boolean } | null> {
  try {
    const { data } = await adminAuth(supabase).getUserById(userId);
    const user = data?.user;
    if (user?.email) return { email: user.email, hasSignedIn: Boolean(user.last_sign_in_at) };
  } catch (err) {
    console.warn("[welcome] getUserById failed", err);
  }
  // Conservative fallback: if we can't read the user, treat as existing so we
  // don't leak an activation link to a stale email.
  if (fallbackEmail) return { email: fallbackEmail, hasSignedIn: true };
  return null;
}

async function generateActivationLink(
  supabase: SupabaseAdmin,
  email: string,
): Promise<string | null> {
  const redirectTo = `${SITE_URL}/auth/continue`;
  try {
    // Guests are provisioned with `email_confirm: true`, which makes Supabase
    // reject `type:"invite"` (invites are for un-confirmed accounts only). Try
    // `recovery` first — it works for both new guests and existing accounts
    // that need a reset — and fall back to `invite` for the rare unconfirmed
    // case.
    let res = await adminAuth(supabase).generateLink({ type: "recovery", email, options: { redirectTo } });
    let link = res.data?.properties?.action_link ?? null;
    if (!link) {
      res = await adminAuth(supabase).generateLink({ type: "invite", email, options: { redirectTo } });
      link = res.data?.properties?.action_link ?? null;
    }
    return link;
  } catch (err) {
    console.warn("[welcome] generateLink failed", err);
    return null;
  }
}

interface RenderArgs {
  firstName: string;
  email: string;
  planName: string;
  ctaUrl: string;
  loginUrl: string;
  showActivation: boolean;
}

function renderHtml(a: RenderArgs): string {
  const steps = a.showActivation
    ? `<ol style="padding-left:20px;margin:0 0 20px;font-size:15px;line-height:1.7;color:#2a2a2a;">
         <li>Click the button below to set your password for <strong>${a.email}</strong> — this is the account tied to your purchase.</li>
         <li>Log in and open <strong>My Courses</strong>.</li>
       </ol>`
    : `<ol style="padding-left:20px;margin:0 0 20px;font-size:15px;line-height:1.7;color:#2a2a2a;">
         <li>Log in with <strong>${a.email}</strong> — the account you used at checkout.</li>
         <li>Head to <strong>My Courses</strong> to start.</li>
       </ol>`;
  const ctaLabel = a.showActivation ? "Set your password" : "Log in now — your access has just been unlocked";
  const subtitle = a.showActivation
    ? `Your purchase is confirmed. Create your password using the same email you used at checkout to unlock access.`
    : `Your purchase is confirmed and your access has just been unlocked. Log in to jump straight in.`;
  return `
    <div style="font-family:'Manrope',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2a2a;">
      <h1 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">Welcome to Alchemy Academy — you're in.</h1>
      <p style="font-size:15px;line-height:1.6;">Congratulations${a.firstName ? `, ${a.firstName}` : ""}! ${subtitle}</p>
      <p style="font-size:14px;line-height:1.6;color:#666;">Plan: <strong>${a.planName}</strong></p>
      <p style="font-size:15px;line-height:1.6;">Here's how to get started:</p>
      ${steps}
      <p style="margin:24px 0;">
        <a href="${a.ctaUrl}" style="display:inline-block;background:#b8934a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">${ctaLabel}</a>
      </p>
      <p style="font-size:14px;line-height:1.6;color:#666;">If the button doesn't work, paste this into your browser:<br/><a href="${a.ctaUrl}">${a.ctaUrl}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <p style="font-size:15px;line-height:1.6;">You now have full access to the Academy's tools and resources — courses, live workshops, our exclusive supplier directory, and a community of alchemists designing homes with intention.</p>
      <p style="font-size:13px;color:#888;margin-top:32px;">Casa Alchemy Studio · With love from Lorena and the team.</p>
    </div>`;
}

function renderPlaintext(a: RenderArgs): string {
  const subtitle = a.showActivation
    ? `Your purchase is confirmed. Create your password using the same email you used at checkout to unlock access.`
    : `Your purchase is confirmed and your access has just been unlocked. Log in to jump straight in.`;
  const steps = a.showActivation
    ? `1. Click this link to set your password for ${a.email} — the account tied to your purchase: ${a.ctaUrl}\n2. Log in and open My Courses.`
    : `1. Log in with ${a.email} — the account you used at checkout: ${a.ctaUrl}\n2. Head to My Courses to start.`;
  return `Welcome to Alchemy Academy — you're in.\n\nCongratulations${a.firstName ? `, ${a.firstName}` : ""}! ${subtitle}\n\nPlan: ${a.planName}\n\nHere's how to get started:\n${steps}\n\nYou now have full access to the Academy's tools and resources — courses, live workshops, our exclusive supplier directory, and a community of alchemists designing homes with intention.\n\nCasa Alchemy Studio`;
}

async function deliver(
  to: string,
  subject: string,
  html: string,
  plaintext: string,
): Promise<Exclude<WelcomeProvider, "skipped">> {
  if (LOVABLE_API_KEY && GOOGLE_MAIL_API_KEY) {
    try {
      const boundary = `casa_${crypto.randomUUID().replace(/-/g, "")}`;
      const rfc2822 = [
        `From: ${FROM_EMAIL}`, `To: ${to}`, `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`, ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`, ``, plaintext, ``,
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`, ``, html, ``,
        `--${boundary}--`, ``,
      ].join("\r\n");
      const raw = btoa(unescape(encodeURIComponent(rfc2822)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      if (res.ok) { await res.text(); return "gmail"; }
      const body = await res.text();
      console.warn(`[welcome] gmail send failed [${res.status}]: ${body} — falling back to Resend`);
    } catch (err) {
      console.warn("[welcome] gmail send threw, falling back to Resend:", err);
    }
  } else {
    console.info("[welcome] gmail: connector env not configured, using Resend");
  }

  if (!RESEND_API_KEY) {
    console.warn("[welcome] resend: RESEND_API_KEY not configured, no fallback available");
    return "failed";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, text: plaintext }),
  });
  if (!res.ok) {
    console.warn(`[welcome] resend send failed [${res.status}]: ${await res.text()}`);
    return "failed";
  }
  await res.text();
  return "resend";
}

interface SendArgs {
  supabase: SupabaseAdmin;
  userId: string;
  fallbackEmail: string | null;
  planKey: string | null;
  /** Exactly one of these must be set; identifies the row that carries the guard. */
  checkoutSessionId?: string;
  subscriptionId?: string;
}

/**
 * Sends the welcome email once per checkout session or subscription.
 *
 * Idempotency: reads `metadata.welcome_email` on the target row before sending
 * and skips when present. After delivery, writes back `{ sent_at, provider,
 * mechanism }`. Stripe webhook retries — and the two annual checkout event
 * types (`completed` vs `async_payment_succeeded`) — cannot double-send.
 *
 * Never throws: any failure is logged and returned as "failed" so a broken
 * email pipeline does not block or roll back access grants.
 */
export async function sendPostPaymentWelcomeEmail(args: SendArgs): Promise<WelcomeProvider> {
  const { supabase, userId, fallbackEmail, planKey, checkoutSessionId, subscriptionId } = args;
  if (!checkoutSessionId && !subscriptionId) {
    console.warn("[welcome] missing guard id — skipping");
    return "failed";
  }

  const table = checkoutSessionId ? "stripe_checkout_sessions" : "stripe_subscriptions";
  const idColumn = checkoutSessionId ? "stripe_session_id" : "stripe_subscription_id";
  const idValue = (checkoutSessionId ?? subscriptionId)!;

  const { data: existing, error: readErr } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { metadata: Record<string, unknown> | null } | null; error: unknown }>;
        };
      };
    };
  }).from(table).select("metadata").eq(idColumn, idValue).maybeSingle();
  if (readErr) {
    console.warn("[welcome] read guard failed", readErr);
    return "failed";
  }
  const meta = (existing?.metadata ?? {}) as Record<string, unknown>;
  if (meta.welcome_email) {
    console.info(`[welcome] already sent for ${idColumn}=${idValue}, skipping`);
    return "skipped";
  }

  const info = await getUserForWelcome(supabase, userId, fallbackEmail);
  if (!info) {
    console.warn(`[welcome] no email resolvable for user ${userId}, skipping`);
    return "failed";
  }

  const loginUrl = `${SITE_URL}/login`;
  const showActivation = !info.hasSignedIn;
  let ctaUrl = loginUrl;
  if (showActivation) {
    const link = await generateActivationLink(supabase, info.email);
    ctaUrl = link ?? loginUrl;
  }

  const firstName = ((info.email.split("@")[0] ?? "").split(/[._+\-]/)[0] ?? "").trim();
  const renderArgs: RenderArgs = {
    firstName,
    email: info.email,
    planName: planLabel(planKey),
    ctaUrl,
    loginUrl,
    showActivation,
  };
  const html = renderHtml(renderArgs);
  const plaintext = renderPlaintext(renderArgs);
  const provider = await deliver(info.email, "Welcome to Alchemy Academy — you're in.", html, plaintext);

  const nextMeta = {
    ...meta,
    welcome_email: {
      sent_at: new Date().toISOString(),
      provider,
      mechanism: showActivation ? "activation_link" : "login_only",
    },
  };
  const { error: writeErr } = await (supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>;
      };
    };
  }).from(table).update({ metadata: nextMeta }).eq(idColumn, idValue);
  if (writeErr) console.warn("[welcome] failed to record welcome_email metadata", writeErr);
  return provider;
}