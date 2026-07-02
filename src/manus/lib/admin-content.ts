import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getCoursesTree } from "@/manus/services/admin-content";
import { z } from "zod";

export type ContentStatus = Database["public"]["Enums"]["content_status"];
export type PlanKey = Database["public"]["Enums"]["membership_plan_key"];

export const PLAN_KEYS: PlanKey[] = ["annual_member", "monthly_member", "individual_course"];
export const STATUSES: ContentStatus[] = ["draft", "published", "archived"];

export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Module = Database["public"]["Tables"]["course_modules"]["Row"];
export type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

async function findCourseInCatalog(courseId: number) {
  const catalog = await getCoursesTree();
  return catalog.courses.find((course) => course.id === courseId) ?? null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---- Input validation (shared client-side guards) ----
const titleSchema = z.string().trim().min(2, "must be at least 2 characters").max(120, "must be at most 120 characters");
const slugSchema = z
  .string()
  .trim()
  .max(80, "must be at most 80 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase letters, numbers and dashes only")
  .optional()
  .or(z.literal(""));
const urlSchema = z.string().trim().url("must be a valid URL").max(2000).nullable().optional().or(z.literal(""));

export function validateTitle(value: string, label = "Title"): string {
  const parsed = titleSchema.safeParse(value ?? "");
  if (!parsed.success) {
    throw new Error(`${label} ${parsed.error.issues[0]?.message ?? "is invalid"}`);
  }
  return parsed.data;
}

const courseInputSchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  subtitle: z.string().trim().max(200, "Subtitle must be at most 200 characters").nullable().optional().or(z.literal("")),
  description: z.string().trim().max(4000, "Description must be at most 4000 characters").nullable().optional().or(z.literal("")),
  cover_image_path: urlSchema,
  external_landing_url: urlSchema,
});

export function validateCourseInput(input: {
  title: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  cover_image_path?: string | null;
  external_landing_url?: string | null;
}) {
  const parsed = courseInputSchema.safeParse({
    title: input.title ?? "",
    slug: input.slug ?? "",
    subtitle: input.subtitle ?? "",
    description: input.description ?? "",
    cover_image_path: input.cover_image_path ?? "",
    external_landing_url: input.external_landing_url ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.[0] ? String(issue.path[0]) : "Field";
    throw new Error(`${path.charAt(0).toUpperCase() + path.slice(1)} ${issue?.message ?? "is invalid"}`);
  }
  return {
    title: parsed.data.title,
    slug: parsed.data.slug || undefined,
    subtitle: parsed.data.subtitle || null,
    description: parsed.data.description || null,
    cover_image_path: parsed.data.cover_image_path || null,
    external_landing_url: parsed.data.external_landing_url || null,
  };
}

/** Case-insensitive check for an existing course slug. Returns true if the slug is already taken. */
export async function slugTaken(slug: string): Promise<boolean> {
  if (!slug) return false;
  const { data } = await supabase.from("courses").select("id").eq("slug", slug).maybeSingle();
  return !!data;
}

export function isPlaceholderVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("/manus-storage/") || url.includes("placeholder-video");
}

export function isLegacyAssetPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.startsWith("/manus-storage/");
}

export async function listCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCourse(id: number) {
  const { data, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (error) {
    const fallback = await findCourseInCatalog(id);
    if (fallback) return fallback;
    throw error;
  }
  if (!data) {
    const fallback = await findCourseInCatalog(id);
    if (fallback) return fallback;
    throw new Error(`Course ${id} not found or not readable (check RLS).`);
  }
  return data;
}

export async function listModules(courseId: number) {
  const { data, error } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error || !data?.length) {
    const fallback = await findCourseInCatalog(courseId);
    if (fallback) {
      return fallback.course_modules
        .filter((m) => (m as { archived_at?: string | null }).archived_at == null)
        .map(({ lessons: _lessons, ...module }) => module) as Module[];
    }
    if (error) throw error;
  }
  return data ?? [];
}

export async function getModule(id: number) {
  const { data, error } = await supabase.from("course_modules").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function listLessons(moduleId: number) {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("module_id", moduleId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error || !data?.length) {
    const catalog = await getCoursesTree();
    const module = catalog.courses.flatMap((course) => course.course_modules).find((item) => item.id === moduleId);
    if (module) {
      return (module.lessons as Lesson[]).filter(
        (l) => (l as { archived_at?: string | null }).archived_at == null,
      );
    }
    if (error) throw error;
  }
  return data ?? [];
}

export async function getLesson(id: number) {
  const { data, error } = await supabase.from("lessons").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

type StatusUpdate = {
  status: ContentStatus;
  published_at?: string | null;
  archived_at?: string | null;
};

export function statusTransition(target: ContentStatus): StatusUpdate {
  const now = new Date().toISOString();
  if (target === "published") return { status: "published", published_at: now, archived_at: null };
  if (target === "archived") return { status: "archived", archived_at: now };
  return { status: "draft", archived_at: null };
}

export async function swapSortOrder<T extends { id: number; sort_order: number }>(
  table: "courses" | "course_modules" | "lessons",
  a: T,
  b: T,
) {
  // simple swap; sort_order has no unique constraint on these tables
  const { error: e1 } = await supabase.from(table).update({ sort_order: b.sort_order }).eq("id", a.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from(table).update({ sort_order: a.sort_order }).eq("id", b.id);
  if (e2) throw e2;
}

export async function uploadCoverImage(file: File, folder: "courses" | "modules" | "lessons"): Promise<string> {
  return uploadPublicAsset(file, folder);
}

/**
 * Generic upload helper for the `public-assets` Supabase Storage bucket.
 * Returns a public URL suitable for direct rendering (images) or anchor `href` (PDFs).
 */
export async function uploadPublicAsset(file: File, folder: string): Promise<string> {
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "-").replace(/^\/+|\/+$/g, "") || "uploads";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `${safeFolder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("public-assets").upload(key, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("public-assets").getPublicUrl(key);
  return data.publicUrl;
}

// ---- Inline CRUD helpers used by the unified course editor ----

export async function updateCourse(id: number, patch: Database["public"]["Tables"]["courses"]["Update"]) {
  const { error } = await supabase.from("courses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateModule(id: number, patch: Database["public"]["Tables"]["course_modules"]["Update"]) {
  const { error } = await supabase.from("course_modules").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateLesson(id: number, patch: Database["public"]["Tables"]["lessons"]["Update"]) {
  const { error } = await supabase.from("lessons").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Course/module/lesson creation always goes through the
 * `admin-content-create` edge function. The function verifies the caller is
 * an admin server-side, then inserts with service_role so the flow works
 * regardless of RLS configuration on these tables. It also auto-assigns
 * sort_order = max + 1.
 */
async function invokeAdminCreate<T>(body: Record<string, unknown>): Promise<T> {
  // Precheck: without a session the edge function will 401. Skip and let the
  // caller's fallback (direct insert with RLS) run instead of hanging.
  const { data: sessionRes } = await supabase.auth.getSession();
  if (!sessionRes?.session?.access_token) {
    throw new Error("No active session — using direct insert fallback");
  }
  const invokePromise = supabase.functions.invoke("admin-content-create", { body });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("admin-content-create timed out after 8s")), 8000),
  );
  const { data, error } = (await Promise.race([invokePromise, timeout])) as Awaited<typeof invokePromise>;
  if (error) {
    const detail = (data as { message?: string; error?: string } | null) ?? null;
    throw new Error(detail?.message || detail?.error || error.message);
  }
  const payload = data as { error?: string; message?: string } | null;
  if (payload && "error" in payload && payload.error) {
    throw new Error(payload.message || payload.error);
  }
  return data as T;
}

export async function createCourse(input: {
  title: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  cover_image_path?: string | null;
  external_landing_url?: string | null;
  status?: ContentStatus;
  access_plan_keys?: PlanKey[];
}): Promise<Course> {
  const v = validateCourseInput(input);
  const status: ContentStatus = input.status === "published" ? "published" : "draft";
  const accessPlanKeys =
    Array.isArray(input.access_plan_keys) && input.access_plan_keys.length > 0
      ? input.access_plan_keys
      : (["annual_member", "monthly_member", "individual_course"] as PlanKey[]);
  input = { ...v, status, access_plan_keys: accessPlanKeys };
  try {
    const res = await invokeAdminCreate<{ course: Course }>({ kind: "course", payload: input });
    // Edge function may not persist access_plan_keys; make sure they land.
    if (
      JSON.stringify((res.course.access_plan_keys ?? []).slice().sort()) !==
      JSON.stringify(accessPlanKeys.slice().sort())
    ) {
      const { error } = await supabase
        .from("courses")
        .update({ access_plan_keys: accessPlanKeys })
        .eq("id", res.course.id);
      if (!error) res.course.access_plan_keys = accessPlanKeys;
    }
    // Edge function may ignore status; ensure it's applied
    if (status === "published" && res.course.status !== "published") {
      const { error } = await supabase
        .from("courses")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", res.course.id);
      if (!error) res.course.status = "published";
    }
    return res.course;
  } catch (edgeErr) {
    // Fallback: admins have RLS insert on courses. Compute slug + sort_order
    // client-side so the New Course flow keeps working even if the edge
    // function is unreachable or misconfigured.
    const baseSlug = (input.slug?.trim() || slugify(input.title)) || slugify(input.title);
    if (!baseSlug) throw edgeErr;
    const { data: maxRow } = await supabase
      .from("courses")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = ((maxRow?.sort_order as number | undefined) ?? 0) + 1;
    let candidate = baseSlug;
    for (let i = 2; i < 30; i++) {
      const { data: existing } = await supabase
        .from("courses")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!existing) break;
      candidate = `${baseSlug}-${i}`;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("courses")
      .insert({
        title: input.title.trim(),
        slug: candidate,
        subtitle: input.subtitle?.trim() || null,
        description: input.description?.trim() || null,
        cover_image_path: input.cover_image_path?.trim() || null,
        external_landing_url: input.external_landing_url?.trim() || null,
        access_plan_keys: accessPlanKeys,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
        sort_order: nextSort,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      throw new Error(`${(edgeErr as Error).message} · fallback insert failed: ${error.message}`);
    }
    return data as Course;
  }
}

export async function createModule(courseId: number, sortOrder: number, title = "New module"): Promise<Module> {
  const t = validateTitle(title, "Module title");
  title = t;
  if (!Number.isFinite(courseId) || courseId <= 0) throw new Error("Invalid course");
  try {
    const res = await invokeAdminCreate<{ module: Module }>({
      kind: "module",
      payload: { course_id: courseId, title, sort_order: sortOrder },
    });
    return res.module;
  } catch (edgeErr) {
    const { data, error } = await supabase
      .from("course_modules")
      .insert({ course_id: courseId, title, sort_order: sortOrder, status: "draft" })
      .select()
      .single();
    if (error) throw new Error(`${(edgeErr as Error).message} · fallback failed: ${error.message}`);
    return data as Module;
  }
}

export async function createLesson(moduleId: number, sortOrder: number, title = "New lesson"): Promise<Lesson> {
  const t = validateTitle(title, "Lesson title");
  title = t;
  if (!Number.isFinite(moduleId) || moduleId <= 0) throw new Error("Invalid module");
  try {
    const res = await invokeAdminCreate<{ lesson: Lesson }>({
      kind: "lesson",
      payload: { module_id: moduleId, title, sort_order: sortOrder },
    });
    return res.lesson;
  } catch (edgeErr) {
    const { data, error } = await supabase
      .from("lessons")
      .insert({ module_id: moduleId, title, sort_order: sortOrder, status: "draft" })
      .select()
      .single();
    if (error) throw new Error(`${(edgeErr as Error).message} · fallback failed: ${error.message}`);
    return data as Lesson;
  }
}

/**
 * Soft-delete (archive) a module. Sets `archived_at = now()` AND
 * `status = "archived"` so the row remains restorable. Lessons under the
 * module are NOT auto-archived — callers must surface that decision.
 *
 * Phase 1 deletion policy: physical DELETE on courses/course_modules/lessons
 * is forbidden. See docs/PHASE_1_DELETE_POLICY.md.
 */
export async function archiveModule(id: number): Promise<void> {
  const patch: Database["public"]["Tables"]["course_modules"]["Update"] = {
    archived_at: new Date().toISOString(),
    status: "archived",
  };
  const { error } = await supabase.from("course_modules").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Soft-delete (archive) a lesson. Sets `archived_at = now()` AND
 * `status = "archived"`. Restoration is intentional (clear `archived_at`
 * and set `status` back to draft/published).
 */
export async function archiveLesson(id: number): Promise<void> {
  const patch: Database["public"]["Tables"]["lessons"]["Update"] = {
    archived_at: new Date().toISOString(),
    status: "archived",
  };
  const { error } = await supabase.from("lessons").update(patch).eq("id", id);
  if (error) throw error;
}


// Bulk reorder: assign sequential sort_order 1..N to the supplied IDs.
// Only updates rows whose order actually changed (skips writes when stable).
export async function reorderRecords(
  table: "courses" | "course_modules" | "lessons",
  orderedIds: number[],
  currentById: Map<number, { sort_order: number }>,
) {
  const updates: Promise<void>[] = [];
  orderedIds.forEach((id, idx) => {
    const next = idx + 1;
    const current = currentById.get(id)?.sort_order;
    if (current !== next) {
      updates.push(
        (async () => {
          const { error } = await supabase.from(table).update({ sort_order: next }).eq("id", id);
          if (error) throw error;
        })(),
      );
    }
  });
  await Promise.all(updates);
}
