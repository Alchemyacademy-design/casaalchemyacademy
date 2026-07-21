import {
  corsHeaders,
  jsonResponse,
  requireUser,
  serviceClient,
  ensureAccessToken,
} from "../_shared/google-calendar-oauth.ts";

const inflight = new Set<string>();

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  const user = await requireUser(req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401, origin);

  if (inflight.has(user.userId)) {
    return jsonResponse({ error: "duplicate_request" }, 429, origin);
  }
  inflight.add(user.userId);
  try {
    const admin = serviceClient();
    let accessToken: string;
    try {
      const t = await ensureAccessToken(admin, user.userId);
      accessToken = t.accessToken;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "not_connected") {
        return jsonResponse({ error: "not_connected" }, 400, origin);
      }
      if (msg === "needs_reconnect") {
        return jsonResponse({ error: "needs_reconnect" }, 401, origin);
      }
      console.error("gcal_test_event_token_failed", { message: msg });
      return jsonResponse({ error: "internal" }, 500, origin);
    }

    const now = new Date();
    const start = new Date(now.getTime() + 10 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const idempotencyKey = `alchemy-test-${user.userId}-${Math.floor(now.getTime() / 60000)}`;

    const body = {
      summary: "Teste de integração — Alchemy Academy",
      description:
        "Este evento confirma que sua Google Agenda foi conectada à Alchemy Academy.",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      extendedProperties: {
        private: {
          alchemy_source: "user_test_event",
          alchemy_user_id: user.userId,
          alchemy_idem: idempotencyKey,
        },
      },
    };

    const listUrl = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    listUrl.searchParams.set("privateExtendedProperty", `alchemy_idem=${idempotencyKey}`);
    listUrl.searchParams.set("maxResults", "1");
    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.ok) {
      const listJson = await listRes.json();
      const first = Array.isArray(listJson.items) && listJson.items[0];
      if (first) {
        return jsonResponse(
          { event_id: first.id, html_link: first.htmlLink, deduped: true },
          200,
          origin,
        );
      }
    } else if (listRes.status === 401) {
      await admin
        .from("google_calendar_connections")
        .update({ connection_status: "needs_reconnect" })
        .eq("user_id", user.userId);
      return jsonResponse({ error: "needs_reconnect" }, 401, origin);
    }

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) {
      await admin
        .from("google_calendar_connections")
        .update({ connection_status: "needs_reconnect" })
        .eq("user_id", user.userId);
      return jsonResponse({ error: "needs_reconnect" }, 401, origin);
    }
    if (!res.ok) {
      const text = await res.text();
      console.error("gcal_test_event_create_failed", {
        status: res.status,
        body: text.slice(0, 300),
      });
      return jsonResponse({ error: "google_error", status: res.status }, 502, origin);
    }
    const created = await res.json();
    return jsonResponse(
      { event_id: created.id, html_link: created.htmlLink, deduped: false },
      200,
      origin,
    );
  } finally {
    inflight.delete(user.userId);
  }
});