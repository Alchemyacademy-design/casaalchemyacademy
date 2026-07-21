import {
  corsHeaders,
  jsonResponse,
  requireUser,
  serviceClient,
  sha256Hex,
  randomToken,
  getRedirectUri,
  GOOGLE_AUTH_URL,
  GOOGLE_SCOPE,
  safeRedirectPath,
} from "../_shared/google-calendar-oauth.ts";

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

  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  if (!clientId) {
    console.error("gcal_oauth_start_missing_client_id");
    return jsonResponse({ error: "server_misconfigured" }, 500, origin);
  }

  let body: { redirect_path?: string } = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }
  const redirectPath = safeRedirectPath(body.redirect_path ?? "/profile");

  const admin = serviceClient();

  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("google_calendar_oauth_states")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.userId)
    .gte("created_at", oneMinAgo);
  if ((count ?? 0) >= 6) {
    return jsonResponse({ error: "rate_limited" }, 429, origin);
  }

  const state = randomToken(32);
  const stateHash = await sha256Hex(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insErr } = await admin
    .from("google_calendar_oauth_states")
    .insert({
      state_hash: stateHash,
      user_id: user.userId,
      redirect_path: redirectPath,
      expires_at: expiresAt,
    });
  if (insErr) {
    console.error("gcal_state_insert_failed", { message: insErr.message });
    return jsonResponse({ error: "internal" }, 500, origin);
  }

  const { data: existing } = await admin
    .from("google_calendar_connections")
    .select("refresh_token_encrypted, connection_status")
    .eq("user_id", user.userId)
    .maybeSingle();

  const needsConsent =
    !existing || !existing.refresh_token_encrypted ||
    existing.connection_status === "needs_reconnect" ||
    existing.connection_status === "disconnected" ||
    existing.connection_status === "revoked";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
  });
  if (needsConsent) params.set("prompt", "consent");

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return jsonResponse({ authorization_url: authUrl }, 200, origin);
});