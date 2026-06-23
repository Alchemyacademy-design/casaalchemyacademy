// admin-content-catalog: returns the full courses/modules/lessons tree for
// administrators. Verifies the JWT, confirms the caller has the `admin`
// role in public.user_roles using service-role (never trusts the client),
// then performs three deterministic reads. Read-only.

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

const isPlaceholder = (url: string | null | undefined) =>
  !url || url.includes("/manus-storage/") || url.includes("placeholder-video");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  // Server-side admin check. Never trust client.
  const { data: roleRows, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleErr) return json({ error: "role_lookup_failed", message: roleErr.message }, 500);
  const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  try {
    type CourseRow = {
      id: number;
      status?: string | null;
      [k: string]: unknown;
    };
    type ModuleRow = {
      id: number;
      course_id: number;
      [k: string]: unknown;
    };
    type LessonRow = {
      id: number;
      module_id: number;
      external_video_url?: string | null;
      [k: string]: unknown;
    };

    const { data: courses, error: cErr } = await admin
      .from("courses")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (cErr) throw cErr;
    const courseRows = (courses ?? []) as CourseRow[];

    const courseIds = courseRows.map((c) => c.id);
    const { data: modules, error: mErr } = courseIds.length
      ? await admin
          .from("course_modules")
          .select("*")
          .in("course_id", courseIds)
          .order("sort_order", { ascending: true })
      : { data: [] as ModuleRow[], error: null };
    if (mErr) throw mErr;
    const moduleRows = (modules ?? []) as ModuleRow[];

    const moduleIds = moduleRows.map((m) => m.id);
    const { data: lessons, error: lErr } = moduleIds.length
      ? await admin
          .from("lessons")
          .select("*")
          .in("module_id", moduleIds)
          .order("sort_order", { ascending: true })
      : { data: [] as LessonRow[], error: null };
    if (lErr) throw lErr;
    const lessonRows = (lessons ?? []) as LessonRow[];

    const lessonsByModule = new Map<number, LessonRow[]>();
    for (const l of lessonRows) {
      const arr = lessonsByModule.get(l.module_id) ?? [];
      arr.push(l);
      lessonsByModule.set(l.module_id, arr);
    }
    const modulesByCourse = new Map<number, Array<ModuleRow & { lessons: LessonRow[] }>>();
    for (const m of moduleRows) {
      const arr = modulesByCourse.get(m.course_id) ?? [];
      arr.push({ ...m, lessons: lessonsByModule.get(m.id) ?? [] });
      modulesByCourse.set(m.course_id, arr);
    }
    const tree = courseRows.map((c) => ({
      ...c,
      course_modules: modulesByCourse.get(c.id) ?? [],
    }));

    let missing = 0;
    let drafts = 0;
    let published = 0;
    let totalLessons = 0;
    let totalModules = 0;
    for (const c of tree) {
      if (c.status === "draft") drafts++;
      if (c.status === "published") published++;
      totalModules += c.course_modules.length;
      for (const m of c.course_modules) {
        totalLessons += m.lessons.length;
        for (const l of m.lessons) if (isPlaceholder(l.external_video_url)) missing++;
      }
    }

    return json({
      courses: tree,
      counts: {
        courses: tree.length,
        modules: totalModules,
        lessons: totalLessons,
        missing_video_urls: missing,
        draft_courses: drafts,
        published_courses: published,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "catalog_failed", message }, 500);
  }
});
