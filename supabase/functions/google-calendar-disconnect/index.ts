import {
  corsHeaders,
  jsonResponse,
  requireUser,
  serviceClient,
  decryptToken,
  revokeToken,
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

  const admin = serviceClient();
  const { data: row } = await admin
    .from("google_calendar_connections")
    .select("id, refresh_token_encrypted, access_token_encrypted")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (row) {
    try {
      const tokenEnc = row.refresh_token_encrypted ?? row.access_token_encrypted;
      if (tokenEnc) {
        const plaintext = await decryptToken(tokenEnc);
        await revokeToken(plaintext);
      }
    } catch (e) {
      console.error("gcal_disconnect_revoke_failed", {
        message: (e as Error).message,
      });
    }
    await admin.from("google_calendar_connections").delete().eq("id", row.id);
  }

  return jsonResponse({ ok: true }, 200, origin);
});