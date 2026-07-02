import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getCoursesTree } from "@/manus/services/admin-content";

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
async function invokeAdminCreate<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-content-create", { body });
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
}): Promise<Course> {
  const res = await invokeAdminCreate<{ course: Course }>({ kind: "course", payload: input });
  return res.course;
}

export async function createModule(courseId: number, sortOrder: number, title = "New module"): Promise<Module> {
  const res = await invokeAdminCreate<{ module: Module }>({
    kind: "module",
    payload: { course_id: courseId, title, sort_order: sortOrder },
  });
  return res.module;
}

export async function createLesson(moduleId: number, sortOrder: number, title = "New lesson"): Promise<Lesson> {
  const res = await invokeAdminCreate<{ lesson: Lesson }>({
    kind: "lesson",
    payload: { module_id: moduleId, title, sort_order: sortOrder },
  });
  return res.lesson;
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
