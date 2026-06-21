import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ContentStatus = Database["public"]["Enums"]["content_status"];
export type PlanKey = Database["public"]["Enums"]["membership_plan_key"];

export const PLAN_KEYS: PlanKey[] = ["annual_member", "monthly_member", "individual_course"];
export const STATUSES: ContentStatus[] = ["draft", "published", "archived"];

export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Module = Database["public"]["Tables"]["course_modules"]["Row"];
export type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

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
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCourse(id: number) {
  const { data, error } = await supabase.from("courses").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function listModules(courseId: number) {
  const { data, error } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
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
    .order("sort_order", { ascending: true });
  if (error) throw error;
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
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
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

export async function createModule(courseId: number, sortOrder: number, title = "New module") {
  const { data, error } = await supabase
    .from("course_modules")
    .insert({ course_id: courseId, title, sort_order: sortOrder, status: "draft" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createLesson(moduleId: number, sortOrder: number, title = "New lesson") {
  const { data, error } = await supabase
    .from("lessons")
    .insert({ module_id: moduleId, title, sort_order: sortOrder, status: "draft" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteModule(id: number) {
  const { error } = await supabase.from("course_modules").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: number) {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
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
