// Public edge function that captures a lead-magnet submission (pop-up or quiz),
// stores it in public.leads, syncs the contact to HubSpot via the Private App
// Token, and sends a confirmation email via Resend.
//
// Deployed with verify_jwt = false; the function is intentionally public so
// unauthenticated visitors can submit. Abuse protection layers:
//   1) honeypot field (silently accepted, no side effects)
//   2) shape validation via zod
//   3) IP-based rate limiting via public.lead_capture_rate_limits
//      (5 submissions per hashed IP per rolling hour window)
//   4) unique(email, source) DB constraint

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { buildGmailRawMessage } from "../_shared/gmail-message.ts";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(4).max(40).optional().or(z.literal(""))
    .transform((v) => (v && v.trim().length >= 4 ? v : null)),
  source: z.enum(["popup", "quiz", "live_workshop", "contact"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Honeypot: legitimate clients leave this empty. Bots often fill it.
  website: z.string().max(0).optional().or(z.literal("")),
});

import { publicUrl } from "../_shared/site-url.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_PRIVATE_APP_TOKEN");
const HUBSPOT_LIST_ID = Deno.env.get("HUBSPOT_LEAD_LIST_ID");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
const MAGAZINE_URL_ENV =
  Deno.env.get("MAGAZINE_PUBLIC_URL") ?? Deno.env.get("FREE_LESSON_PUBLIC_URL");
const LESSON_VIDEO_URL_ENV = Deno.env.get("FREE_LESSON_VIDEO_URL") ?? Deno.env.get("MAGAZINE_PDF_URL");
// Default asset paths (uploaded via lovable-assets, served from the app origin).
const DEFAULT_LESSON_VIDEO_URL =
  "https://www.dropbox.com/scl/fi/sqlkz21s0kfeq37neolat/how-to-mix-prints.mp4?rlkey=xytd5hqcruap575dftwk3fc1h&raw=1";
const DEFAULT_LESSON_COVER_PATH =
  "/__l5e/assets-v1/96d5c4a8-449b-43cc-837d-3ec6ac081833/how-to-mix-prints-banner.png";
// The `from` address must belong to a domain verified in Resend.
// Uses onboarding@resend.dev when nothing is configured — that only delivers
// to the Resend account owner, so verify a domain and set FROM_EMAIL for real
// lead delivery.
const FROM_EMAIL = Deno.env.get("LEAD_MAGNET_FROM_EMAIL") ?? "Casa Alchemy <onboarding@resend.dev>";

const HUBSPOT_BASE = "https://api.hubapi.com";
// HubSpot Forms submission (public endpoint — no token required).
// Casa Alchemy portal + the "subscribers" form Lorena shared.
const HUBSPOT_PORTAL_ID = Deno.env.get("HUBSPOT_PORTAL_ID") ?? "442909568";
const HUBSPOT_FORM_GUID =
  Deno.env.get("HUBSPOT_FORM_GUID") ?? "3305b4c1-94e1-4576-a0b6-c2ef4dba3fb5";
const HUBSPOT_FORMS_BASE = "https://api.hsforms.com/submissions/v3/integration/submit";
const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

// Rate-limit config: max submissions per hashed IP per window.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type LeadSource = "popup" | "quiz" | "live_workshop" | "contact";

function labelForLead(source: LeadSource, placement?: string, workshopTitle?: string | null): string {
  if (source === "contact") return "Contact Form";
  if (source === "live_workshop") {
    return workshopTitle
      ? `Ask the Expert LIVE — ${workshopTitle}`
      : "Ask the Expert LIVE";
  }
  const p = (placement ?? "").toLowerCase();
  if (p === "footer") return "Homepage Footer — Free Lesson";
  if (p === "popup") return "Website Pop-up — Free Lesson";
  if (p === "quiz_gate") return "Course Quiz — Free Lesson";
  // Fallbacks based on source enum when placement is missing.
  return source === "popup" ? "Website Pop-up — Free Lesson" : "Course Quiz — Free Lesson";
}

function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  const firstname = parts.shift() ?? "";
  const lastname = parts.join(" ");
  return { firstname, lastname };
}

async function ensureHubspotLeadSourceProperty(): Promise<void> {
  if (!HUBSPOT_TOKEN) return;
  // Idempotent: 409 is ignored. This runs on every invoke; HubSpot is fine
  // with it and it lets Lorena skip the console step.
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/properties/contacts/lead_source`, {
    method: "GET",
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (res.status === 200) { await res.text(); return; }
  await res.text();
  const create = await fetch(`${HUBSPOT_BASE}/crm/v3/properties/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "lead_source",
      label: "Lead source",
      type: "string",
      fieldType: "text",
      groupName: "contactinformation",
      description: "Marketing source that captured this lead.",
    }),
  });
  const body = await create.text();
  if (!create.ok && create.status !== 409) {
    console.warn(`hubspot: could not ensure lead_source property [${create.status}]: ${body}`);
  }
}

async function upsertHubspotContact(input: {
  email: string;
  firstname: string;
  lastname: string;
  phone: string | null;
  source: LeadSource;
  placement?: string;
  workshopTitle?: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  if (!HUBSPOT_TOKEN) return { id: null, error: "HUBSPOT_PRIVATE_APP_TOKEN not configured" };

  const properties: Record<string, string> = {
    email: input.email,
    firstname: input.firstname,
    lastname: input.lastname,
    lead_source: labelForLead(input.source, input.placement, input.workshopTitle),
  };
  if (input.phone) properties.phone = input.phone;

  // Try PATCH by email idProperty first. If contact does not exist, POST.
  const patch = await fetch(
    `${HUBSPOT_BASE}/crm/v3/objects/contacts/${encodeURIComponent(input.email)}?idProperty=email`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    },
  );
  if (patch.ok) {
    const data = await patch.json();
    return { id: (data?.id as string) ?? null, error: null };
  }
  const patchBody = await patch.text();
  if (patch.status !== 404) {
    console.warn(`hubspot patch [${patch.status}]: ${patchBody}`);
  }

  const post = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
  });
  if (!post.ok) {
    const body = await post.text();
    return { id: null, error: `hubspot create failed [${post.status}]: ${body}` };
  }
  const data = await post.json();
  return { id: (data?.id as string) ?? null, error: null };
}

// Pushes the lead into the HubSpot form so it lands in the same submissions
// list Lorena watches. Public endpoint, no auth. Never throws.
async function submitHubspotForm(input: {
  email: string;
  firstname: string;
  lastname: string;
  phone: string | null;
  source: LeadSource;
  placement?: string;
  workshopTitle?: string | null;
  pageUri: string;
  pageName: string;
  hutk?: string | null;
}): Promise<string | null> {
  if (!HUBSPOT_PORTAL_ID || !HUBSPOT_FORM_GUID) return "hubspot form not configured";
  const fields = [
    { name: "email", value: input.email },
    { name: "firstname", value: input.firstname },
    { name: "lastname", value: input.lastname },
    { name: "phone", value: input.phone },
    { name: "lead_source", value: labelForLead(input.source, input.placement, input.workshopTitle) },
  ].filter((f) => typeof f.value === "string" && f.value.trim().length > 0);

  const payload: Record<string, unknown> = {
    fields,
    context: {
      pageUri: input.pageUri,
      pageName: input.pageName,
      ...(input.hutk ? { hutk: input.hutk } : {}),
    },
  };

  try {
    const res = await fetch(
      `${HUBSPOT_FORMS_BASE}/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = await res.text();
    if (!res.ok) {
      console.warn(`hubspot form submit [${res.status}]: ${body}`);
      return `hubspot form submit failed [${res.status}]: ${body}`;
    }
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("hubspot form submit threw:", msg);
    return msg;
  }
}

async function addToStaticList(contactId: string): Promise<void> {
  if (!HUBSPOT_TOKEN || !HUBSPOT_LIST_ID) return;
  // Legacy contact lists v1 API remains the simplest for static-list adds.
  const res = await fetch(
    `${HUBSPOT_BASE}/contacts/v1/lists/${encodeURIComponent(HUBSPOT_LIST_ID)}/add`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vids: [Number(contactId)] }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    console.warn(`hubspot list add [${res.status}]: ${body}`);
  } else {
    await res.text();
  }
}

async function sendConfirmationEmail(input: {
  to: string;
  name: string;
  lessonPageUrl: string;
  lessonVideoUrl: string;
  coverUrl: string;
}): Promise<"gmail" | "resend" | "failed"> {
  const firstName = input.name.trim().split(/\s+/)[0] ?? "";
  const subject = "Your free lesson — How to Mix Prints";
  let offersUrl: string;
  try {
    offersUrl = new URL("/#offers", input.lessonPageUrl).toString();
  } catch {
    offersUrl = `${input.lessonPageUrl}#offers`;
  }
  const html = `
    <div style="font-family:'Manrope',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2a2a;">
      <h1 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">Your first lesson is on us.</h1>
      <p style="font-size:15px;line-height:1.6;">Thanks for subscribing, ${firstName}. Your free lesson <strong>How to Mix Prints</strong>, with Lorena Couto, is ready to watch. Inside: how to combine patterns, scale and colour so a room feels layered instead of loud.</p>
      <p style="margin:20px 0;text-align:center;">
        <a href="${input.lessonPageUrl}"><img src="${input.coverUrl}" alt="How to Mix Prints — free lesson" width="440" style="max-width:100%;height:auto;border-radius:4px;border:1px solid #eee;" /></a>
      </p>
      <p style="margin:24px 0;">
        <a href="${input.lessonPageUrl}" style="display:inline-block;background:#2a2a2a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:500;letter-spacing:0.02em;">Watch the free lesson</a>
      </p>
      <p style="font-size:14px;line-height:1.6;color:#666;">If the button doesn't work, paste this into your browser:<br/><a href="${input.lessonPageUrl}">${input.lessonPageUrl}</a><br/><br/>Direct video link: <a href="${input.lessonVideoUrl}">${input.lessonVideoUrl}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <h2 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:20px;margin:0 0 8px;">Ready for the full toolkit?</h2>
      <p style="font-size:15px;line-height:1.6;">This lesson is a preview of how we teach. Inside the Alchemy Academy you get the full method — courses, live workshops, and a community designing their own homes with intention.</p>
      <p style="margin:20px 0 28px;">
        <a href="${offersUrl}" style="display:inline-block;background:#b8934a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Explore the Academy plans</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <p style="font-size:13px;color:#888;">Casa Alchemy Studio · With love from Lorena and the team.</p>
    </div>`;
  const plaintext = `Your first lesson is on us.\n\nThanks for subscribing, ${firstName}. Your free lesson "How to Mix Prints", with Lorena Couto, is ready to watch.\n\nInside: how to combine patterns, scale and colour so a room feels layered instead of loud.\n\nWatch: ${input.lessonPageUrl}\nDirect video: ${input.lessonVideoUrl}\n\nReady for the full toolkit? Explore the Alchemy Academy plans: ${offersUrl}\n\nCasa Alchemy Studio`;

  return deliverEmail({ to: input.to, subject, html, plaintext });
}

// Shared transport: Gmail via the Lovable connector gateway, Resend fallback.
async function deliverEmail(input: {
  to: string;
  subject: string;
  html: string;
  plaintext: string;
}): Promise<"gmail" | "resend" | "failed"> {
  const { subject, html, plaintext } = input;
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
      console.warn(`gmail send threw, falling back to Resend:`, e);
    }
  } else {
    console.info("gmail: connector env not configured, falling back to Resend");
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

function formatWorkshopWhen(startsAt: string, endsAt: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "UTC",
  };
  const start = new Date(startsAt).toLocaleString("en-AU", opts);
  if (!endsAt) return start;
  const end = new Date(endsAt).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  return `${start} – ${end}`;
}

async function sendWorkshopConfirmationEmail(input: {
  to: string;
  name: string;
  workshopTitle: string;
  when: string;
  coverUrl: string | null;
  pageUrl: string;
}): Promise<"gmail" | "resend" | "failed"> {
  const firstName = input.name.trim().split(/\s+/)[0] ?? "";
  const subject = `You're confirmed — ${input.workshopTitle}`;
  const offersUrl = publicUrl("/#offers");
  const html = `
    <div style="font-family:'Manrope',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2a2a;">
      <h1 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">You're in, ${firstName}.</h1>
      <p style="font-size:15px;line-height:1.6;">Your seat is confirmed for <strong>${input.workshopTitle}</strong>.</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;"><strong>When:</strong> ${input.when}</p>
      ${input.coverUrl ? `<p style="margin:20px 0;text-align:center;"><img src="${input.coverUrl}" alt="${input.workshopTitle}" width="440" style="max-width:100%;height:auto;border-radius:4px;border:1px solid #eee;" /></p>` : ""}
      <p style="font-size:15px;line-height:1.6;">The private class link is not published anywhere — we'll email it to you closer to the session, so keep an eye on this inbox.</p>
      <p style="font-size:14px;line-height:1.6;color:#666;">Need the details again? <a href="${input.pageUrl}">${input.pageUrl}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <h2 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:20px;margin:0 0 8px;">While you wait</h2>
      <p style="font-size:15px;line-height:1.6;">Inside the Alchemy Academy you get the full method — courses, expert masterclasses, and a community designing their own homes with intention.</p>
      <p style="margin:20px 0 28px;">
        <a href="${offersUrl}" style="display:inline-block;background:#b8934a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Explore the Academy plans</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <p style="font-size:13px;color:#888;">Casa Alchemy Studio · With love from Lorena and the team.</p>
    </div>`;
  const plaintext = `You're in, ${firstName}.\n\nYour seat is confirmed for "${input.workshopTitle}".\n\nWhen: ${input.when}\n\nThe private class link is not published anywhere — we'll email it to you closer to the session.\n\nDetails: ${input.pageUrl}\n\nExplore the Alchemy Academy plans: ${offersUrl}\n\nCasa Alchemy Studio`;
  return deliverEmail({ to: input.to, subject, html, plaintext });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "invalid_payload", details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const { name, email, phone, source, metadata, website } = parsed.data;
  if (website && website.length > 0) {
    // Silently accept honeypot hits but do nothing else.
    return new Response(JSON.stringify({ ok: true, redirect: "/free-lesson" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Email links must always point at the public site, never at the
  // preview/sandbox origin the request happened to come from.
  const lessonPageUrl = MAGAZINE_URL_ENV || publicUrl("/free-lesson");
  const lessonVideoUrl = LESSON_VIDEO_URL_ENV || DEFAULT_LESSON_VIDEO_URL;
  const coverUrl = publicUrl(DEFAULT_LESSON_COVER_PATH);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Upsert into public.leads (unique on lower(email), source).
  const ipHeader = req.headers.get("x-forwarded-for") ?? "";
  const ip = ipHeader.split(",")[0]?.trim() ?? "";
  const ipHash = ip
    ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip))))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32)
    : null;

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  // IP-based rate limiting. We bucket by a fixed rolling window (floor of
  // now to the hour). If we can't hash an IP (missing header), skip — the
  // honeypot + unique(email, source) constraint still provide protection.
  if (ipHash) {
    const windowStart = new Date(
      Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS,
    ).toISOString();
    const { data: existingLimit, error: limitReadErr } = await supabase
      .from("lead_capture_rate_limits")
      .select("attempt_count")
      .eq("ip_hash", ipHash)
      .eq("window_start", windowStart)
      .maybeSingle();
    if (limitReadErr) {
      console.warn("rate limit read failed, failing open:", limitReadErr);
    } else if ((existingLimit?.attempt_count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: "rate_limited" }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
          },
        },
      );
    }
    const nextCount = (existingLimit?.attempt_count ?? 0) + 1;
    const { error: limitWriteErr } = await supabase
      .from("lead_capture_rate_limits")
      .upsert(
        {
          ip_hash: ipHash,
          window_start: windowStart,
          attempt_count: nextCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ip_hash,window_start" },
      );
    if (limitWriteErr) {
      console.warn("rate limit write failed:", limitWriteErr);
    }
  }

  const { data: leadRow, error: upsertErr } = await supabase
    .from("leads")
    .upsert(
      {
        name,
        email,
        phone,
        source,
        metadata: metadata ?? {},
        ip_hash: ipHash,
        user_agent: userAgent,
      },
      { onConflict: "email,source", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (upsertErr) {
    console.error("leads upsert failed:", upsertErr);
    return new Response(JSON.stringify({ error: "storage_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // HubSpot sync — non-blocking (log on failure, still return success so the
  // visitor gets the free lesson).
  const { firstname, lastname } = splitName(name);
  // Workshop context (public "Ask the Expert LIVE" landing page).
  const workshopId = typeof metadata?.workshop_id === "number"
    ? metadata.workshop_id
    : typeof metadata?.workshop_id === "string" && /^\d+$/.test(metadata.workshop_id)
      ? Number(metadata.workshop_id)
      : null;
  const workshopSlug = typeof metadata?.workshop_slug === "string" ? metadata.workshop_slug : null;
  let workshop: {
    id: number; slug: string; title: string; starts_at: string; ends_at: string | null; cover_image_path: string | null;
  } | null = null;
  if (source === "live_workshop" && (workshopId || workshopSlug)) {
    let q = supabase
      .from("live_workshops")
      .select("id,slug,title,starts_at,ends_at,cover_image_path")
      .limit(1);
    q = workshopId ? q.eq("id", workshopId) : q.eq("slug", workshopSlug as string);
    const { data: wRow, error: wErr } = await q.maybeSingle();
    if (wErr) console.warn("workshop lookup failed:", wErr);
    workshop = wRow ?? null;
  }
  const workshopTitle = workshop?.title ?? null;
  const hubspotCookie = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)hubspotutk=([^;]+)/)?.[1] ?? null;
  let hubspotContactId: string | null = null;
  let hubspotError: string | null = null;
  try {
    await ensureHubspotLeadSourceProperty();
    const placement = typeof metadata?.placement === "string" ? metadata.placement : undefined;
    const upserted = await upsertHubspotContact({ email, firstname, lastname, phone, source, placement, workshopTitle });
    hubspotContactId = upserted.id;
    hubspotError = upserted.error;
    if (upserted.id) await addToStaticList(upserted.id);
    const formErr = await submitHubspotForm({
      email,
      firstname,
      lastname,
      phone,
      source,
      placement,
      workshopTitle,
      pageUri: typeof metadata?.page_uri === "string" ? metadata.page_uri : lessonPageUrl,
      pageName: labelForLead(source, placement, workshopTitle),
      hutk: hubspotCookie,
    });
    if (formErr) hubspotError = hubspotError ? `${hubspotError}; ${formErr}` : formErr;
  } catch (e) {
    hubspotError = (e as Error).message;
    console.error("hubspot sync error:", e);
  }

  await supabase
    .from("leads")
    .update({
      hubspot_contact_id: hubspotContactId,
      hubspot_synced_at: hubspotContactId ? new Date().toISOString() : null,
      hubspot_error: hubspotError,
    })
    .eq("id", leadRow.id);

  // Confirmation email (also non-blocking). Contact form submissions do not
  // receive the free-lesson sequence.
  let emailProvider: "gmail" | "resend" | "failed" | "skipped" = source === "contact" ? "skipped" : "failed";
  try {
    if (source === "contact") {
      // no automated follow-up email for raw contact messages
    } else if (source === "live_workshop" && workshop) {
      emailProvider = await sendWorkshopConfirmationEmail({
        to: email,
        name,
        workshopTitle: workshop.title,
        when: formatWorkshopWhen(workshop.starts_at, workshop.ends_at),
        coverUrl: workshop.cover_image_path,
        pageUrl: publicUrl(`/ask-the-expert/${workshop.slug}`),
      });
    } else {
      emailProvider = await sendConfirmationEmail({ to: email, name, lessonPageUrl, lessonVideoUrl, coverUrl });
    }
  } catch (e) {
    console.error("confirmation email error:", e);
  }

  try {
    const nextMetadata = { ...(metadata ?? {}), email_provider_used: emailProvider };
    await supabase.from("leads").update({ metadata: nextMetadata }).eq("id", leadRow.id);
  } catch (e) {
    console.warn("failed to record email_provider_used:", e);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      redirect: source === "live_workshop" && workshop
        ? `/ask-the-expert/${workshop.slug}`
        : "/free-lesson",
      leadId: leadRow.id,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});