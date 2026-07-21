import {
  corsHeaders,
  jsonResponse,
  requireUser,
  serviceClient,
  maskEmail,
} from "../_shared/google-calendar-oauth.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  const user = await requireUser(req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401, origin);

  const admin = serviceClient();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select(
      "google_account_email, connection_status, connected_at, token_expires_at, refresh_token_encrypted",
    )
    .eq("user_id", user.userId)
    .maybeSingle();
  if (error) {
    console.error("gcal_status_read_failed", { message: error.message });
    return jsonResponse({ error: "internal" }, 500, origin);
  }
  if (!data) {
    return jsonResponse(
      { connected: false, connection_status: "disconnected" },
      200,
      origin,
    );
  }
  const needsReconnect =
    data.connection_status === "needs_reconnect" ||
    (data.connection_status === "connected" && !data.refresh_token_encrypted);
  return jsonResponse(
    {
      connected: data.connection_status === "connected" && !needsReconnect,
      connection_status: data.connection_status,
      google_account_email: maskEmail(data.google_account_email),
      connected_at: data.connected_at,
      needs_reconnect: needsReconnect,
    },
    200,
    origin,
  );
});