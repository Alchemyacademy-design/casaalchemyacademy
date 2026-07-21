import {
  serviceClient,
  sha256Hex,
  exchangeCodeForTokens,
  encryptToken,
  getFrontendUrl,
  safeRedirectPath,
  GOOGLE_SCOPE,
} from "../_shared/google-calendar-oauth.ts";

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { Location: to } });
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const frontend = getFrontendUrl();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return redirect(`${frontend}/profile?google_calendar=denied`);
  if (!code || !state) return redirect(`${frontend}/profile?google_calendar=denied`);

  const admin = serviceClient();
  const stateHash = await sha256Hex(state);

  const { data: stateRow, error: stateErr } = await admin
    .from("google_calendar_oauth_states")
    .select("id, user_id, redirect_path, expires_at, consumed_at")
    .eq("state_hash", stateHash)
    .maybeSingle();
  if (stateErr || !stateRow) {
    console.error("gcal_callback_state_missing", { hasErr: !!stateErr });
    return redirect(`${frontend}/profile?google_calendar=error`);
  }
  if (stateRow.consumed_at) {
    return redirect(`${frontend}/profile?google_calendar=error`);
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return redirect(`${frontend}/profile?google_calendar=expired`);
  }

  await admin
    .from("google_calendar_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", stateRow.id)
    .is("consumed_at", null);

  const redirectPath = safeRedirectPath(stateRow.redirect_path);

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (e) {
    console.error("gcal_callback_exchange_failed", { message: (e as Error).message });
    return redirect(`${frontend}${redirectPath}?google_calendar=error`);
  }

  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes(GOOGLE_SCOPE)) {
    return redirect(`${frontend}${redirectPath}?google_calendar=denied`);
  }

  const email = await fetchGoogleEmail(tokens.access_token);

  const { data: prior } = await admin
    .from("google_calendar_connections")
    .select("id, refresh_token_encrypted")
    .eq("user_id", stateRow.user_id)
    .maybeSingle();

  const accessEnc = await encryptToken(tokens.access_token);
  const refreshEnc = tokens.refresh_token
    ? await encryptToken(tokens.refresh_token)
    : prior?.refresh_token_encrypted ?? null;

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const payload = {
    user_id: stateRow.user_id,
    google_account_email: email,
    access_token_encrypted: accessEnc,
    refresh_token_encrypted: refreshEnc,
    token_expires_at: expiresAt,
    granted_scopes: scopes,
    connection_status: "connected" as const,
    connected_at: new Date().toISOString(),
    disconnected_at: null,
  };

  const { error: upErr } = await admin
    .from("google_calendar_connections")
    .upsert(payload, { onConflict: "user_id" });
  if (upErr) {
    console.error("gcal_callback_upsert_failed", { message: upErr.message });
    return redirect(`${frontend}${redirectPath}?google_calendar=error`);
  }

  return redirect(`${frontend}${redirectPath}?google_calendar=connected`);
});