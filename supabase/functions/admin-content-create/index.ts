// admin-content-create: creates courses, course_modules, and lessons on
// behalf of a verified admin using the service role. This exists so the
// New course / Add module / Add lesson flows always succeed regardless of
// how RLS is configured on the target tables. The JWT is verified and the
// caller MUST have the `admin` role in public.user_roles.

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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type Body =
  | {
      kind: "course";
      payload: {
        title: string;
        slug?: string | null;
        subtitle?: string | null;
        description?: string | null;
        cover_image_path?: string | null;
      };
    }
  | { kind: "module"; payload: { course_id: number; title?: string | null; sort_order?: number | null } }
  | { kind: "lesson"; payload: { module_id: number; title?: string | null; sort_order?: number | null } };

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
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data: roleRows, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleErr) return json({ error: "role_lookup_failed", message: roleErr.message }, 500);
  const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  try {
    if (body.kind === "course") {
      const { title, slug, subtitle, description, cover_image_path } = body.payload;
      if (!title || !title.trim()) return json({ error: "title_required" }, 400);
      const baseSlug = (slug && slug.trim()) || slugify(title);
      if (!baseSlug) return json({ error: "slug_invalid" }, 400);

      // Compute next sort_order = max + 1
      const { data: maxRow } = await admin
        .from("courses")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = ((maxRow?.sort_order as number | undefined) ?? 0) + 1;

      // Ensure unique slug — append -2, -3, … as needed.
      let candidate = baseSlug;
      let suffix = 1;
      // Try up to 25 times, then fail loudly.
      for (let i = 0; i < 25; i++) {
        const { data: existing } = await admin
          .from("courses")
          .select("id")
          .eq("slug", candidate)
          .maybeSingle();
        if (!existing) break;
        suffix += 1;
        candidate = `${baseSlug}-${suffix}`;
      }

      const { data, error } = await admin
        .from("courses")
        .insert({
          title: title.trim(),
          slug: candidate,
          subtitle: subtitle?.trim() || null,
          description: description?.trim() || null,
          cover_image_path: cover_image_path?.trim() || null,
          status: "draft",
          sort_order: nextSort,
          created_by: userId,
        })
        .select()
        .single();
      if (error) return json({ error: "insert_failed", message: error.message, hint: error.hint, details: error.details }, 500);
      return json({ course: data });
    }

    if (body.kind === "module") {
      const { course_id, title, sort_order } = body.payload;
      if (!course_id) return json({ error: "course_id_required" }, 400);
      let nextSort = sort_order ?? null;
      if (nextSort == null) {
        const { data: maxRow } = await admin
          .from("course_modules")
          .select("sort_order")
          .eq("course_id", course_id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        nextSort = ((maxRow?.sort_order as number | undefined) ?? 0) + 1;
      }
      const { data, error } = await admin
        .from("course_modules")
        .insert({
          course_id,
          title: (title && title.trim()) || "New module",
          sort_order: nextSort,
          status: "draft",
        })
        .select()
        .single();
      if (error) return json({ error: "insert_failed", message: error.message, hint: error.hint, details: error.details }, 500);
      return json({ module: data });
    }

    if (body.kind === "lesson") {
      const { module_id, title, sort_order } = body.payload;
      if (!module_id) return json({ error: "module_id_required" }, 400);
      let nextSort = sort_order ?? null;
      if (nextSort == null) {
        const { data: maxRow } = await admin
          .from("lessons")
          .select("sort_order")
          .eq("module_id", module_id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        nextSort = ((maxRow?.sort_order as number | undefined) ?? 0) + 1;
      }
      const { data, error } = await admin
        .from("lessons")
        .insert({
          module_id,
          title: (title && title.trim()) || "New lesson",
          sort_order: nextSort,
          status: "draft",
        })
        .select()
        .single();
      if (error) return json({ error: "insert_failed", message: error.message, hint: error.hint, details: error.details }, 500);
      return json({ lesson: data });
    }

    return json({ error: "unknown_kind" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "server_error", message }, 500);
  }
});
