// sync-event-to-google-calendar: admin-only. Pushes public.events rows into a
// Google Calendar via the Lovable connector gateway (google_calendar). Handles
// insert (POST /events), update (PATCH /events/{id}) and delete
// (DELETE /events/{id}). Never trusts client-supplied payloads — reloads the
// event from Supabase using service-role before every call. The gateway
// handles OAuth token refresh transparently.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAdminUser } from "../_shared/quiz-access.ts";

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

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";
// Platform is Australia-based — events entered in Admin are Sydney local time.
const CALENDAR_TZ = Deno.env.get("GOOGLE_CALENDAR_TIMEZONE") || "Australia/Sydney";

// Format a UTC instant as a naive wall-clock string (YYYY-MM-DDTHH:mm:ss) in
// the given IANA timezone. Google Calendar treats `dateTime` without a UTC
// offset + explicit `timeZone` as local time in that zone, which is what we
// want — sending an ISO string with `Z` makes Google ignore `timeZone`.
function toZonedWallTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`;
}

function log(step: string, extra: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ fn: "sync-event-to-google-calendar", step, ...extra }));
  } catch {
    console.log(`sync-event-to-google-calendar:${step}`);
  }
}

function gatewayHeaders() {
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const conn = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!lovable) throw new Error("missing_lovable_api_key");
  if (!conn) throw new Error("missing_google_calendar_api_key");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

// deno-lint-ignore no-explicit-any
function toGCalEvent(ev: any) {
  const start = ev.starts_at as string;
  const end = (ev.ends_at as string | null) ??
    new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
  const descriptionParts: string[] = [];
  if (ev.description) descriptionParts.push(String(ev.description));
  if (ev.external_url) descriptionParts.push(`More info: ${ev.external_url}`);
  descriptionParts.push(`— Synced from Alchemy Academy (event #${ev.id})`);
  return {
    summary: ev.title,
    description: descriptionParts.join("\n\n"),
    location: ev.location ?? undefined,
    start: { dateTime: toZonedWallTime(start, CALENDAR_TZ), timeZone: CALENDAR_TZ },
    end: { dateTime: toZonedWallTime(end, CALENDAR_TZ), timeZone: CALENDAR_TZ },
    source: ev.external_url
      ? { title: "Alchemy Academy", url: ev.external_url }
      : undefined,
    extendedProperties: {
      private: {
          alchemy_source_type: "event",
        alchemy_event_id: String(ev.id),
        alchemy_slug: String(ev.slug ?? ""),
      },
    },
  };
}

// Look up an existing Google Calendar event owned by this platform for the
// given source id via extendedProperties. Returns the first match's id +
// htmlLink, or null. Used as an idempotency fallback when the DB row has no
// google_calendar_event_id (e.g. after a failed sync that partially created
// the remote event) so retries never duplicate.
async function findExistingByPrivateProp(
  encodedCalendar: string,
  sourceType: "event" | "workshop",
  sourceId: string | number,
): Promise<{ id: string; htmlLink: string | null } | null> {
  try {
    const url =
      `${GATEWAY_BASE}/calendars/${encodedCalendar}/events` +
      `?privateExtendedProperty=${encodeURIComponent("alchemy_source_type=" + sourceType)}` +
      `&privateExtendedProperty=${encodeURIComponent("alchemy_event_id=" + String(sourceId))}` +
      `&showDeleted=false&maxResults=5`;
    const res = await fetch(url, { method: "GET", headers: gatewayHeaders() });
    if (!res.ok) {
      log("dedupe_search_failed", { status: res.status });
      return null;
    }
    const body = await res.json() as { items?: Array<{ id?: string; htmlLink?: string; status?: string }> };
    const hit = (body.items ?? []).find((it) => it?.id && it.status !== "cancelled");
    return hit?.id ? { id: hit.id, htmlLink: hit.htmlLink ?? null } : null;
  } catch (e) {
    log("dedupe_search_exception", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    log("function_started");
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authed = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, service);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await authed.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;
    if (!(await isAdminUser(admin, userId))) return json({ error: "forbidden" }, 403);
    log("admin_authenticated", { user_id: userId });

    const body = await req.json().catch(() => null) as
      | { event_id?: number; action?: "upsert" | "delete" | "cancel" }
      | null;
    const eventId = Number(body?.event_id);
    const rawAction = body?.action;
    // "cancel" is accepted as an alias for "delete" to match the admin-side
    // vocabulary (archive/cancel/delete all result in the same GCal removal).
    const action = rawAction === "cancel" ? "delete" : rawAction;
    if (!Number.isFinite(eventId) || (action !== "upsert" && action !== "delete")) {
      return json({ error: "invalid_request" }, 400);
    }
    log("request_parsed", { event_id: eventId, action });

    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();
    if (evErr) return json({ error: "db_error", details: evErr.message }, 500);
    if (!ev) return json({ error: "event_not_found" }, 404);
    log("event_loaded", { event_id: eventId, status: ev.status, has_external_id: !!ev.google_calendar_event_id });

    const existingId = ev.google_calendar_event_id as string | null;
    const encodedCalendar = encodeURIComponent(CALENDAR_ID);

    // DELETE branch — either explicit delete request, or archived/draft on upsert.
    const shouldDelete = action === "delete" ||
      (action === "upsert" && (ev.archived_at || ev.status !== "published"));

    // Mark pending immediately so the admin calendar shows the transition
    // via realtime while the Google call is in flight.
    await admin
      .from("events")
      .update({ google_calendar_sync_status: "pending", google_calendar_sync_error: null })
      .eq("id", eventId);
    log("payload_built", { should_delete: shouldDelete, calendar_id: CALENDAR_ID, timezone: CALENDAR_TZ });

    let gatewayStatus = 0;
    let gatewayBody = "";
    let newExternalId: string | null = existingId;
    let newHtmlLink: string | null = (ev.google_calendar_html_link as string | null) ?? null;
    let newStatus: string = ev.google_calendar_sync_status as string;
    let newError: string | null = null;

    if (shouldDelete) {
      if (!existingId) {
        newStatus = "deleted";
        newExternalId = null;
        newHtmlLink = null;
      } else {
        const res = await fetch(
          `${GATEWAY_BASE}/calendars/${encodedCalendar}/events/${encodeURIComponent(existingId)}`,
          { method: "DELETE", headers: gatewayHeaders() },
        );
        gatewayStatus = res.status;
        gatewayBody = await res.text();
        // 200/204 = deleted; 404/410 = already gone — treat both as success.
        if (res.ok || res.status === 404 || res.status === 410) {
          newStatus = "deleted";
          newExternalId = null;
          newHtmlLink = null;
        } else {
          newStatus = "failed";
          newError = `[${res.status}] ${gatewayBody.slice(0, 500)}`;
        }
      }
    } else {
      const gcalBody = toGCalEvent(ev);
      // Idempotency: if we have no persisted GCal id, first search Google
      // for a prior copy tagged with alchemy_event_id and reuse it. This
      // prevents duplicates from retries after a partial failure.
      let effectiveId = existingId;
      if (!effectiveId) {
        const found = await findExistingByPrivateProp(encodedCalendar, "event", ev.id);
        if (found) {
          effectiveId = found.id;
          newHtmlLink = found.htmlLink ?? newHtmlLink;
          log("dedupe_reused_existing", { existing_id: found.id });
        }
      }
      const res = effectiveId
        ? await fetch(
          `${GATEWAY_BASE}/calendars/${encodedCalendar}/events/${encodeURIComponent(effectiveId)}`,
          { method: "PATCH", headers: gatewayHeaders(), body: JSON.stringify(gcalBody) },
        )
        : await fetch(
          `${GATEWAY_BASE}/calendars/${encodedCalendar}/events`,
          { method: "POST", headers: gatewayHeaders(), body: JSON.stringify(gcalBody) },
        );
      gatewayStatus = res.status;
      gatewayBody = await res.text();

      // If PATCH target is gone at Google, retry as insert.
      if (effectiveId && (res.status === 404 || res.status === 410)) {
        const retry = await fetch(
          `${GATEWAY_BASE}/calendars/${encodedCalendar}/events`,
          { method: "POST", headers: gatewayHeaders(), body: JSON.stringify(gcalBody) },
        );
        gatewayStatus = retry.status;
        gatewayBody = await retry.text();
        if (retry.ok) {
          const parsed = JSON.parse(gatewayBody);
          newExternalId = parsed.id ?? null;
          newHtmlLink = parsed.htmlLink ?? null;
          newStatus = "synced";
        } else {
          newStatus = "failed";
          newError = `[${retry.status}] ${gatewayBody.slice(0, 500)}`;
        }
      } else if (res.ok) {
        const parsed = gatewayBody ? JSON.parse(gatewayBody) : {};
        newExternalId = parsed.id ?? effectiveId;
        newHtmlLink = parsed.htmlLink ?? newHtmlLink;
        newStatus = "synced";
      } else {
        newStatus = "failed";
        newError = `[${res.status}] ${gatewayBody.slice(0, 500)}`;
      }
    }

    log("gateway_called", { gateway_status: gatewayStatus, result_status: newStatus, has_html_link: !!newHtmlLink });

    const { error: updErr } = await admin
      .from("events")
      .update({
        google_calendar_event_id: newExternalId,
        google_calendar_html_link: newHtmlLink,
        google_calendar_synced_at: new Date().toISOString(),
        google_calendar_sync_status: newStatus,
        google_calendar_sync_error: newError,
      })
      .eq("id", eventId);
    if (updErr) return json({ error: "db_update_failed", details: updErr.message }, 500);
    log("db_updated", { event_id: eventId, final_status: newStatus });

    return json({
      ok: newStatus === "synced" || newStatus === "deleted",
      status: newStatus,
      google_calendar_event_id: newExternalId,
      google_calendar_html_link: newHtmlLink,
      gateway_status: gatewayStatus,
      error: newError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "internal", details: msg }, 500);
  }
});