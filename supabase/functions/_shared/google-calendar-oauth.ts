// Shared helpers for the own-OAuth Google Calendar integration.
// Never logs plaintext tokens. Never returns tokens to the client.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

function allowedOrigin(origin: string | null): string {
  const frontend = Deno.env.get("APP_FRONTEND_URL") ?? "";
  const allowlist = new Set(
    [
      frontend,
      "https://casaalchemyacademy.lovable.app",
      "https://id-preview--4bd39e1f-a399-4009-a1dd-236116924dc4.lovable.app",
      "http://localhost:8080",
      "http://localhost:5173",
    ].filter(Boolean),
  );
  if (origin && allowlist.has(origin)) return origin;
  return frontend || "https://casaalchemyacademy.lovable.app";
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireUser(
  req: Request,
): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { userId: data.user.id, token };
}

// -------- crypto --------

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("missing_encryption_key");
  // Accept either 32-byte base64 or a passphrase; hash to 32 bytes with SHA-256.
  let keyBytes: Uint8Array;
  try {
    const decoded = b64decode(raw);
    if (decoded.length === 32) {
      keyBytes = decoded;
    } else {
      keyBytes = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
      );
    }
  } catch {
    keyBytes = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
    );
  }
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

const ENC_VERSION = "v1";

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return `${ENC_VERSION}.${b64encode(iv)}.${b64encode(ct)}`;
}

export async function decryptToken(payload: string): Promise<string> {
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== ENC_VERSION) {
    throw new Error("invalid_encrypted_payload");
  }
  const key = await getEncryptionKey();
  const iv = b64decode(parts[1]);
  const ct = b64decode(parts[2]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)),
  );
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  // URL-safe base64
  return b64encode(buf).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

// -------- google api --------

export function getRedirectUri(): string {
  return (
    Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI") ??
    "https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/google-calendar-oauth-callback"
  );
}

export function getFrontendUrl(): string {
  return Deno.env.get("APP_FRONTEND_URL") ?? "https://casaalchemyacademy.lovable.app";
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "",
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("google_token_exchange_failed", { status: res.status });
    throw new Error(`token_exchange_failed:${res.status}`);
  }
  return await res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    console.error("google_token_refresh_failed", { status: res.status });
    throw new Error(`token_refresh_failed:${res.status}`);
  }
  return await res.json();
}

export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.ok;
  } catch (e) {
    console.error("google_revoke_failed", { message: (e as Error).message });
    return false;
  }
}

/**
 * Ensures a fresh access token for the connection. Refreshes if within 60s of expiry.
 * Persists rotated tokens. Marks connection needs_reconnect on refresh failure.
 * Returns the plaintext access token (do NOT log it or return it to the client).
 */
export async function ensureAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string; email: string | null }> {
  const { data: row, error } = await admin
    .from("google_calendar_connections")
    .select(
      "id, user_id, google_account_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, connection_status",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("db_read_failed");
  if (!row) throw new Error("not_connected");
  if (row.connection_status === "disconnected" || row.connection_status === "revoked") {
    throw new Error("not_connected");
  }

  const nowMs = Date.now();
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  const stillValid = expiresAt - nowMs > 60_000;

  if (stillValid) {
    const accessToken = await decryptToken(row.access_token_encrypted);
    return { accessToken, email: row.google_account_email };
  }

  if (!row.refresh_token_encrypted) {
    await admin
      .from("google_calendar_connections")
      .update({ connection_status: "needs_reconnect" })
      .eq("id", row.id);
    throw new Error("needs_reconnect");
  }

  try {
    const refreshToken = await decryptToken(row.refresh_token_encrypted);
    const tokens = await refreshAccessToken(refreshToken);
    const newAccessEnc = await encryptToken(tokens.access_token);
    const newRefreshEnc = tokens.refresh_token
      ? await encryptToken(tokens.refresh_token)
      : row.refresh_token_encrypted;
    const newExpiresAt = new Date(nowMs + tokens.expires_in * 1000).toISOString();
    await admin
      .from("google_calendar_connections")
      .update({
        access_token_encrypted: newAccessEnc,
        refresh_token_encrypted: newRefreshEnc,
        token_expires_at: newExpiresAt,
        connection_status: "connected",
      })
      .eq("id", row.id);
    return { accessToken: tokens.access_token, email: row.google_account_email };
  } catch (_e) {
    await admin
      .from("google_calendar_connections")
      .update({ connection_status: "needs_reconnect" })
      .eq("id", row.id);
    throw new Error("needs_reconnect");
  }
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export function safeRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/")) return "/profile";
  if (path.startsWith("//")) return "/profile";
  // limit length
  return path.slice(0, 200);
}