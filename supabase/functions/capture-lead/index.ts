// Public edge function that captures a lead-magnet submission (pop-up or quiz),
// stores it in public.leads, syncs the contact to HubSpot via the Private App
// Token, and sends a confirmation email via Resend.
//
// Deployed with verify_jwt = false; the function is intentionally public so
// unauthenticated visitors can submit. Rate limiting is a known gap; we rely
// on the (email, source) unique index + honeypot + shape validation.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(4).max(40),
  source: z.enum(["popup", "quiz"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Honeypot: legitimate clients leave this empty. Bots often fill it.
  website: z.string().max(0).optional().or(z.literal("")),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_PRIVATE_APP_TOKEN");
const HUBSPOT_LIST_ID = Deno.env.get("HUBSPOT_LEAD_LIST_ID");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
const MAGAZINE_URL_ENV =
  Deno.env.get("MAGAZINE_PUBLIC_URL") ?? Deno.env.get("FREE_LESSON_PUBLIC_URL");
const MAGAZINE_PDF_URL_ENV = Deno.env.get("MAGAZINE_PDF_URL");
// The `from` address must belong to a domain verified in Resend.
// Uses onboarding@resend.dev when nothing is configured — that only delivers
// to the Resend account owner, so verify a domain and set FROM_EMAIL for real
// lead delivery.
const FROM_EMAIL = Deno.env.get("LEAD_MAGNET_FROM_EMAIL") ?? "Casa Alchemy <onboarding@resend.dev>";

const HUBSPOT_BASE = "https://api.hubapi.com";
const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function labelForLead(source: "popup" | "quiz", placement?: string): string {
  const p = (placement ?? "").toLowerCase();
  if (p === "footer") return "Homepage Footer — Magazine";
  if (p === "popup") return "Website Pop-up — Magazine";
  if (p === "quiz_gate") return "Course Quiz — Magazine";
  // Fallbacks based on source enum when placement is missing.
  return source === "popup" ? "Website Pop-up — Magazine" : "Course Quiz — Magazine";
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
  phone: string;
  source: "popup" | "quiz";
  placement?: string;
}): Promise<{ id: string | null; error: string | null }> {
  if (!HUBSPOT_TOKEN) return { id: null, error: "HUBSPOT_PRIVATE_APP_TOKEN not configured" };

  const properties = {
    email: input.email,
    firstname: input.firstname,
    lastname: input.lastname,
    phone: input.phone,
    lead_source: labelForLead(input.source, input.placement),
  };

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
  magazineUrl: string;
  downloadUrl: string;
}): Promise<"gmail" | "resend" | "failed"> {
  const firstName = input.name.trim().split(/\s+/)[0] ?? "";
  const subject = "Thanks for subscribing — here's your magazine";
  let offersUrl: string;
  try {
    offersUrl = new URL("/#offers", input.magazineUrl).toString();
  } catch {
    offersUrl = `${input.magazineUrl}#offers`;
  }
  const html = `
    <div style="font-family:'Manrope',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2a2a;">
      <h1 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">Consider this your first experiment.</h1>
      <p style="font-size:15px;line-height:1.6;">Thanks for subscribing, ${firstName}. Your free copy of the latest Casa Alchemy magazine is ready — real projects, real principles, and the professional knowledge you need to design your own home with confidence.</p>
      <p style="margin:24px 0;">
        <a href="${input.downloadUrl}" style="display:inline-block;background:#2a2a2a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:500;letter-spacing:0.02em;">Download the magazine</a>
      </p>
      <p style="font-size:14px;line-height:1.6;color:#666;">If the button doesn't work, paste this into your browser:<br/><a href="${input.downloadUrl}">${input.downloadUrl}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <h2 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:20px;margin:0 0 8px;">Ready for the full toolkit?</h2>
      <p style="font-size:15px;line-height:1.6;">The magazine is a preview of how we think. Inside the Alchemy Academy you get the full method — courses, live workshops, and a community designing their own homes with intention.</p>
      <p style="margin:20px 0 28px;">
        <a href="${offersUrl}" style="display:inline-block;background:#b8934a;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Explore the Academy plans</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <p style="font-size:13px;color:#888;">Casa Alchemy Studio · With love from Lorena and the team.</p>
    </div>`;
  const plaintext = `Consider this your first experiment.\n\nThanks for subscribing, ${firstName}. Your free copy of the Casa Alchemy magazine is ready.\n\nDownload: ${input.downloadUrl}\n\nReady for the full toolkit? Explore the Alchemy Academy plans: ${offersUrl}\n\nCasa Alchemy Studio`;

  // Gmail first (via Lovable connector gateway — sends from Lorena's inbox).
  if (LOVABLE_API_KEY && GOOGLE_MAIL_API_KEY) {
    try {
      const boundary = `casa_${crypto.randomUUID().replace(/-/g, "")}`;
      const rfc2822 = [
        `From: ${FROM_EMAIL}`,
        `To: ${input.to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        plaintext,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        html,
        ``,
        `--${boundary}--`,
        ``,
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
    return new Response(JSON.stringify({ ok: true, redirect: "/magazine" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const origin = req.headers.get("origin") ?? `${url.protocol}//${url.host}`;
  const magazineUrl = MAGAZINE_URL_ENV || `${origin}/magazine`;
  const downloadUrl = MAGAZINE_PDF_URL_ENV || magazineUrl;

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
  let hubspotContactId: string | null = null;
  let hubspotError: string | null = null;
  try {
    await ensureHubspotLeadSourceProperty();
    const placement = typeof metadata?.placement === "string" ? metadata.placement : undefined;
    const upserted = await upsertHubspotContact({ email, firstname, lastname, phone, source, placement });
    hubspotContactId = upserted.id;
    hubspotError = upserted.error;
    if (upserted.id) await addToStaticList(upserted.id);
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

  // Confirmation email (also non-blocking).
  let emailProvider: "gmail" | "resend" | "failed" = "failed";
  try {
    emailProvider = await sendConfirmationEmail({ to: email, name, magazineUrl, downloadUrl });
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
    JSON.stringify({ ok: true, redirect: "/magazine", leadId: leadRow.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});