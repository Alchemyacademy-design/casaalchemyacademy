// invite-user-to-google-event
//
// User-facing endpoint. When an authenticated student clicks "Participate" on
// an event or live workshop, this function invites their email as a Google
// Calendar attendee on the ADMIN-owned event (the one previously synced by
// sync-event-to-google-calendar / sync-workshop-to-google-calendar). It does
// NOT use the App User Connector — all Google calls run through the admin
// gateway credential.
//
// Rules enforced:
//   - Auth required; email comes from auth.getUser() (never from the client).
//   - Registration must already exist for the (user, target) pair.
//   - Attendees are merged case-insensitively; existing invitees are preserved.
//   - Concurrency handled with If-Match / etag; retry once on 412.
//   - Guest privacy locked: guestsCanSeeOtherGuests=false,
//     guestsCanInviteOthers=false, guestsCanModify=false.
//   - sendUpdates=all so Google emails the invite.
//   - Never logs email in full — only masked.
//   - On any failure the registration STAYS. sync fields track state.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const shown = local.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function log(step: string, extra: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ fn: "invite-user-to-google-event", step, ...extra }));
  } catch {
    console.log(`invite-user-to-google-event:${step}`);
  }
}

function gatewayHeaders(extra: Record<string, string> = {}) {
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const conn = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!lovable) throw new Error("missing_lovable_api_key");
  if (!conn) throw new Error("missing_google_calendar_api_key");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
    ...extra,
  } as Record<string, string>;
}

type Attendee = { email: string; responseStatus?: string; displayName?: string };

async function fetchGoogleEvent(gcalId: string): Promise<
  { ok: true; etag: string; attendees: Attendee[]; status: number }
  | { ok: false; status: number; body: string }
> {
  const url = `${GATEWAY_BASE}/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(gcalId)}`;
  const res = await fetch(url, { method: "GET", headers: gatewayHeaders() });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  const parsed = JSON.parse(text) as { etag?: string; attendees?: Attendee[] };
  return {
    ok: true,
    status: res.status,
    etag: parsed.etag ?? "",
    attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
  };
}

async function patchGoogleEvent(gcalId: string, attendees: Attendee[], etag: string) {
  const url = `${GATEWAY_BASE}/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(gcalId)}?sendUpdates=all`;
  const body = {
    attendees,
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
    guestsCanModify: false,
  };
  const headers = gatewayHeaders(etag ? { "If-Match": etag } : {});
  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text };
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
    const authed = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await authed.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;
    const userEmail = (userData.user.email ?? "").trim().toLowerCase();
    if (!userEmail) return json({ error: "email_missing" }, 400);

    const body = await req.json().catch(() => null) as
      | { target_type?: "event" | "live_workshop"; target_id?: number; action?: "invite" | "remove" }
      | null;
    const targetType = body?.target_type;
    const targetId = Number(body?.target_id);
    const action = body?.action ?? "invite";
    if ((targetType !== "event" && targetType !== "live_workshop") || !Number.isFinite(targetId)) {
      return json({ error: "invalid_request" }, 400);
    }
    if (action !== "invite" && action !== "remove") return json({ error: "invalid_action" }, 400);
    log("request_parsed", { user_id: userId, target_type: targetType, target_id: targetId, action });

    // Load registration (must exist for this user + target).
    const regQuery = admin.from("registrations").select("*").eq("user_id", userId);
    const regRes = targetType === "event"
      ? await regQuery.eq("event_id", targetId).maybeSingle()
      : await regQuery.eq("live_workshop_id", targetId).maybeSingle();
    if (regRes.error) return json({ error: "db_error", details: regRes.error.message }, 500);
    if (!regRes.data) return json({ error: "not_registered" }, 404);
    const reg = regRes.data;

    // Load target row to get google_calendar_event_id.
    const table = targetType === "event" ? "events" : "live_workshops";
    const { data: target, error: tErr } = await admin
      .from(table)
      .select("id, title, starts_at, google_calendar_event_id, google_calendar_sync_status")
      .eq("id", targetId)
      .maybeSingle();
    if (tErr) return json({ error: "db_error", details: tErr.message }, 500);
    if (!target) return json({ error: "target_not_found" }, 404);

    const gcalId = target.google_calendar_event_id as string | null;

    // If the admin event isn't synced to Google yet, mark pending and exit
    // gracefully. The user's registration is untouched.
    if (!gcalId) {
      await admin.from("registrations").update({
        user_google_calendar_sync_status: "pending",
        user_google_calendar_sync_error: "admin_event_not_synced",
        updated_at: new Date().toISOString(),
      }).eq("id", reg.id);
      log("admin_event_not_synced", { target_id: targetId });
      return json({ ok: false, status: "pending", reason: "admin_event_not_synced" });
    }

    // Short-circuit: already invited for this action.
    if (action === "invite" && reg.user_google_calendar_sync_status === "invited") {
      return json({ ok: true, status: "invited", already: true, masked_email: maskEmail(userEmail) });
    }

    // Mark pending before Google call.
    await admin.from("registrations").update({
      user_google_calendar_sync_status: "pending",
      user_google_calendar_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", reg.id);

    // GET current event to preserve existing attendees + get etag.
    let attempt = 0;
    let finalStatus = 0;
    let finalBody = "";
    let syncedOk = false;

    while (attempt < 2) {
      attempt++;
      const current = await fetchGoogleEvent(gcalId);
      if (!current.ok) {
        finalStatus = current.status;
        finalBody = current.body;
        break;
      }
      const existing = current.attendees ?? [];
      const emailLower = userEmail.toLowerCase();
      const alreadyPresent = existing.some(a => (a.email ?? "").toLowerCase() === emailLower);

      let nextAttendees: Attendee[];
      if (action === "invite") {
        if (alreadyPresent) {
          nextAttendees = existing;
        } else {
          nextAttendees = [...existing, { email: userEmail }];
        }
      } else {
        if (!alreadyPresent) {
          nextAttendees = existing;
        } else {
          nextAttendees = existing.filter(a => (a.email ?? "").toLowerCase() !== emailLower);
        }
      }

      // If nothing to change (e.g. remove but not present), succeed w/o PATCH.
      const changed = nextAttendees.length !== existing.length ||
        nextAttendees.some((a, i) => (a.email ?? "").toLowerCase() !== (existing[i]?.email ?? "").toLowerCase());
      if (!changed) {
        syncedOk = true;
        finalStatus = 200;
        break;
      }

      const patched = await patchGoogleEvent(gcalId, nextAttendees, current.etag);
      finalStatus = patched.status;
      finalBody = patched.body;

      // 412 Precondition Failed => someone else updated the event. Retry once.
      if (patched.status === 412 && attempt < 2) {
        log("etag_conflict_retry", { target_id: targetId });
        continue;
      }
      if (patched.ok) {
        syncedOk = true;
      }
      break;
    }

    const nowIso = new Date().toISOString();
    const newStatus = syncedOk
      ? (action === "invite" ? "invited" : "removed")
      : "failed";
    const errStr = syncedOk ? null : `[${finalStatus}] ${finalBody.slice(0, 400)}`;

    const { error: updErr } = await admin.from("registrations").update({
      user_google_calendar_sync_status: newStatus,
      user_google_calendar_sync_error: errStr,
      user_google_calendar_event_id: syncedOk && action === "invite" ? gcalId : (action === "remove" ? null : reg.user_google_calendar_event_id),
      user_google_calendar_synced_at: nowIso,
      updated_at: nowIso,
    }).eq("id", reg.id);
    if (updErr) log("db_update_failed", { error: updErr.message });

    log("gateway_called", { gateway_status: finalStatus, result_status: newStatus, action, email_masked: maskEmail(userEmail) });

    return json({
      ok: syncedOk,
      status: newStatus,
      masked_email: maskEmail(userEmail),
      gateway_status: finalStatus,
      error: errStr,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "internal", details: msg }, 500);
  }
});