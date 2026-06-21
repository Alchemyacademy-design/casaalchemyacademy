// lesson-video-url: emits a short-lived signed URL for a private object in
// the `lesson-videos` bucket. Authorization (in priority order):
//   1. admin role
//   2. active membership (status='active' AND ends_at > now)
//   3. active course_entitlements row for the lesson's parent course
//
// Request:  POST { lessonId: number, expiresIn?: number /* seconds, 60-3600 */ }
// Response: { url: string, expiresAt: string } | { error: string }

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  let body: { lessonId?: number; expiresIn?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const lessonId = Number(body.lessonId);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return json({ error: "lessonId_required" }, 400);
  }
  const expiresIn = Math.min(Math.max(Number(body.expiresIn ?? 900), 60), 3600);

  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data: lesson, error: lessonErr } = await admin
    .from("lessons")
    .select("id, external_video_url, course_modules!inner(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonErr) return json({ error: "lesson_lookup_failed", message: lessonErr.message }, 500);
  if (!lesson) return json({ error: "lesson_not_found" }, 404);

  const url = (lesson as { external_video_url: string | null }).external_video_url ?? "";
  if (!url.startsWith("lesson-videos://")) {
    return json({ error: "lesson_video_not_private" }, 400);
  }
  const objectPath = url.slice("lesson-videos://".length);
  const courseId =
    (lesson as { course_modules: { course_id: number } | null }).course_modules?.course_id ?? null;

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");

  let authorized = isAdmin;
  if (!authorized) {
    const nowIso = new Date().toISOString();
    const [{ data: memberships }, { data: entitlements }] = await Promise.all([
      admin
        .from("memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("ends_at", nowIso)
        .limit(1),
      courseId
        ? admin
            .from("course_entitlements")
            .select("id")
            .eq("user_id", userId)
            .eq("course_id", courseId)
            .eq("active", true)
            .gt("ends_at", nowIso)
            .limit(1)
        : Promise.resolve({ data: [] as Array<{ id: number }> }),
    ]);
    authorized = (memberships?.length ?? 0) > 0 || (entitlements?.length ?? 0) > 0;
  }

  if (!authorized) return json({ error: "forbidden" }, 403);

  const { data: signed, error: signErr } = await admin.storage
    .from("lesson-videos")
    .createSignedUrl(objectPath, expiresIn);
  if (signErr || !signed?.signedUrl) {
    return json({ error: "sign_failed", message: signErr?.message ?? "no url" }, 500);
  }

  return json({
    url: signed.signedUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
});
