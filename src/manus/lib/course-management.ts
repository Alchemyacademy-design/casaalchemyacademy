import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Course, Module, Lesson, ContentStatus, PlanKey } from "@/manus/lib/admin-content";

export type CourseAccessType = Database["public"]["Enums"]["course_access_type"];
export type CourseReleaseType = Database["public"]["Enums"]["course_release_type"];
export type CourseLevel = Database["public"]["Enums"]["course_level"];
export type CourseVisibility = Database["public"]["Enums"]["course_visibility"];
export type Category = Database["public"]["Tables"]["course_categories"]["Row"];

export const CONTENT_STATUSES: ContentStatus[] = ["draft", "in_review", "scheduled", "published", "archived"];
export const ACCESS_TYPES: CourseAccessType[] = ["free", "paid", "plan", "manual", "private", "product", "time_limited", "lifetime", "cohort"];
export const RELEASE_TYPES: CourseReleaseType[] = ["all_at_once", "drip_days", "drip_date", "after_previous_lesson", "after_previous_module", "manual", "per_cohort"];
export const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

export interface CourseRow extends Course {
  category?: Category | null;
  instructor_display?: string | null;
  lessons_count: number;
  enrollments_count: number;
}

export interface ListParams {
  search?: string;
  status?: ContentStatus | "all";
  instructorId?: string | "all";
  categoryId?: number | "all";
  from?: string | null;
  to?: string | null;
  sort?: "title_asc" | "title_desc" | "updated_desc" | "updated_asc" | "status";
  page?: number;
  pageSize?: number;
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("course_categories").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listInstructors(): Promise<{ id: string; label: string }[]> {
  // Distinct instructor_ids present on courses (avoids scanning entire profiles).
  const { data, error } = await supabase.from("courses").select("instructor_id, instructor_name").not("instructor_id", "is", null);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const r of data ?? []) {
    const id = (r as { instructor_id: string | null }).instructor_id;
    const name = (r as { instructor_name: string | null }).instructor_name;
    if (id && !map.has(id)) map.set(id, name || id.slice(0, 8));
  }
  return Array.from(map, ([id, label]) => ({ id, label }));
}

export async function listCoursesRich(params: ListParams = {}): Promise<{ rows: CourseRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20));
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let q = supabase
    .from("courses")
    .select("*, category:course_categories(*)", { count: "exact" })
    .is("archived_at", null);

  if (params.search) q = q.or(`title.ilike.%${params.search}%,slug.ilike.%${params.search}%`);
  if (params.status && params.status !== "all") q = q.eq("status", params.status);
  if (params.instructorId && params.instructorId !== "all") q = q.eq("instructor_id", params.instructorId);
  if (params.categoryId && params.categoryId !== "all") q = q.eq("category_id", params.categoryId);
  if (params.from) q = q.gte("created_at", params.from);
  if (params.to) q = q.lte("created_at", params.to);

  switch (params.sort) {
    case "title_asc": q = q.order("title", { ascending: true }); break;
    case "title_desc": q = q.order("title", { ascending: false }); break;
    case "updated_asc": q = q.order("updated_at", { ascending: true }); break;
    case "status": q = q.order("status").order("title"); break;
    case "updated_desc":
    default: q = q.order("updated_at", { ascending: false });
  }

  const { data, count, error } = await q.range(rangeFrom, rangeTo);
  if (error) throw error;
  const rows = (data ?? []) as unknown as CourseRow[];
  if (rows.length === 0) return { rows, total: count ?? 0 };

  const courseIds = rows.map((r) => r.id);
  // Lesson counts via modules -> lessons (single roundtrip per aggregate).
  const [{ data: modRows }, { data: entRows }] = await Promise.all([
    supabase.from("course_modules").select("id, course_id").in("course_id", courseIds).is("archived_at", null),
    supabase.from("course_entitlements").select("course_id").in("course_id", courseIds).eq("active", true),
  ]);
  const moduleIds = (modRows ?? []).map((m) => m.id);
  const modByCourse = new Map<number, number[]>();
  for (const m of modRows ?? []) {
    const arr = modByCourse.get(m.course_id) ?? [];
    arr.push(m.id);
    modByCourse.set(m.course_id, arr);
  }
  const { data: lessonRows } = moduleIds.length
    ? await supabase.from("lessons").select("module_id").in("module_id", moduleIds).is("archived_at", null)
    : { data: [] as { module_id: number }[] };

  const lessonByModule = new Map<number, number>();
  for (const l of lessonRows ?? []) lessonByModule.set(l.module_id, (lessonByModule.get(l.module_id) ?? 0) + 1);
  const entByCourse = new Map<number, number>();
  for (const e of entRows ?? []) entByCourse.set(e.course_id, (entByCourse.get(e.course_id) ?? 0) + 1);

  for (const row of rows) {
    const mods = modByCourse.get(row.id) ?? [];
    row.lessons_count = mods.reduce((a, m) => a + (lessonByModule.get(m) ?? 0), 0);
    row.enrollments_count = entByCourse.get(row.id) ?? 0;
    row.instructor_display = row.instructor_name ?? null;
  }
  return { rows, total: count ?? 0 };
}

// -------------------- Mutations --------------------

function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function publishCourse(id: number, opts: { immediate?: boolean; scheduledAt?: string | null } = {}): Promise<void> {
  const patch: Database["public"]["Tables"]["courses"]["Update"] = opts.scheduledAt
    ? { status: "scheduled", scheduled_publish_at: opts.scheduledAt }
    : { status: "published", published_at: new Date().toISOString(), scheduled_publish_at: null };
  const { error } = await withTimeout(supabase.from("courses").update(patch).eq("id", id), 8000, "Publish course");
  if (error) throw error;
}

export async function setCourseStatus(id: number, status: ContentStatus): Promise<void> {
  const patch: Database["public"]["Tables"]["courses"]["Update"] = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  const { error } = await withTimeout(supabase.from("courses").update(patch).eq("id", id), 8000, "Update status");
  if (error) throw error;
}

export async function archiveCourse(id: number): Promise<void> {
  const { error } = await withTimeout(
    supabase.from("courses").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id),
    8000, "Archive course",
  );
  if (error) throw error;
}

export async function duplicateCourse(id: number): Promise<Course> {
  const { data: src, error: srcErr } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (srcErr || !src) throw srcErr ?? new Error("Course not found");
  const baseSlug = `${src.slug}-copy`;
  let slug = baseSlug;
  for (let i = 2; i <= 20; i++) {
    const { data: hit } = await supabase.from("courses").select("id").eq("slug", slug).maybeSingle();
    if (!hit) break;
    slug = `${baseSlug}-${i}`;
  }
  const insert: Database["public"]["Tables"]["courses"]["Insert"] = {
    title: `${src.title} (copy)`, slug,
    subtitle: src.subtitle, description: src.description, short_description: src.short_description,
    cover_image_path: src.cover_image_path, banner_url: src.banner_url, trailer_url: src.trailer_url,
    category_id: src.category_id, instructor_id: src.instructor_id, instructor_name: src.instructor_name,
    level: src.level, language: src.language, estimated_duration: src.estimated_duration,
    has_certificate: src.has_certificate, is_featured: false,
    access_type: src.access_type, access_plan_keys: src.access_plan_keys, release_type: src.release_type,
    external_landing_url: src.external_landing_url, visibility: src.visibility,
    status: "draft",
  };
  const { data, error } = await supabase.from("courses").insert(insert).select().single();
  if (error) throw error;
  return data as Course;
}

// -------- Structure / reorder --------

export async function listModulesFull(courseId: number): Promise<Module[]> {
  const { data, error } = await supabase.from("course_modules").select("*").eq("course_id", courseId).is("archived_at", null).order("sort_order");
  if (error) throw error;
  return (data ?? []) as Module[];
}
export async function listLessonsFull(moduleIds: number[]): Promise<Lesson[]> {
  if (!moduleIds.length) return [];
  const { data, error } = await supabase.from("lessons").select("*").in("module_id", moduleIds).is("archived_at", null).order("sort_order");
  if (error) throw error;
  return (data ?? []) as Lesson[];
}
export async function reorderModules(orderedIds: number[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) => supabase.from("course_modules").update({ sort_order: idx + 1 }).eq("id", id)));
}
export async function reorderLessons(moduleId: number, orderedIds: number[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) => supabase.from("lessons").update({ sort_order: idx + 1, module_id: moduleId }).eq("id", id)));
}
export async function moveLessonToModule(lessonId: number, toModuleId: number, sortOrder: number): Promise<void> {
  const { error } = await supabase.from("lessons").update({ module_id: toModuleId, sort_order: sortOrder }).eq("id", lessonId);
  if (error) throw error;
}
export async function duplicateLesson(lessonId: number): Promise<Lesson> {
  const { data: src, error: srcErr } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  if (srcErr || !src) throw srcErr ?? new Error("Lesson not found");
  const { data: max } = await supabase.from("lessons").select("sort_order").eq("module_id", src.module_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const next = ((max?.sort_order as number | undefined) ?? 0) + 1;
  const insert: Database["public"]["Tables"]["lessons"]["Insert"] = {
    module_id: src.module_id, title: `${src.title} (copy)`, sort_order: next, status: "draft",
    description: src.description, content_text: src.content_text, external_video_url: src.external_video_url,
    external_resource_url: src.external_resource_url, lesson_type: src.lesson_type,
    duration_seconds: src.duration_seconds, is_mandatory: src.is_mandatory, is_preview: src.is_preview,
    allow_comments: src.allow_comments, allow_download: src.allow_download, release_type: src.release_type,
  };
  const { data, error } = await supabase.from("lessons").insert(insert).select().single();
  if (error) throw error;
  return data as Lesson;
}
export async function duplicateModule(moduleId: number): Promise<Module> {
  const { data: src, error: srcErr } = await supabase.from("course_modules").select("*").eq("id", moduleId).maybeSingle();
  if (srcErr || !src) throw srcErr ?? new Error("Module not found");
  const { data: max } = await supabase.from("course_modules").select("sort_order").eq("course_id", src.course_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const next = ((max?.sort_order as number | undefined) ?? 0) + 1;
  const { data: newMod, error } = await supabase.from("course_modules").insert({
    course_id: src.course_id, title: `${src.title} (copy)`, description: src.description,
    sort_order: next, status: "draft", release_type: src.release_type, access_plan_keys: src.access_plan_keys,
  }).select().single();
  if (error) throw error;
  const { data: origLessons } = await supabase.from("lessons").select("*").eq("module_id", moduleId).is("archived_at", null).order("sort_order");
  if (origLessons?.length) {
    const inserts = origLessons.map((l, i) => ({
      module_id: newMod.id, title: l.title, sort_order: i + 1, status: "draft" as ContentStatus,
      description: l.description, content_text: l.content_text, external_video_url: l.external_video_url,
      external_resource_url: l.external_resource_url, lesson_type: l.lesson_type,
      duration_seconds: l.duration_seconds, is_mandatory: l.is_mandatory, is_preview: l.is_preview,
      allow_comments: l.allow_comments, allow_download: l.allow_download, release_type: l.release_type,
    }));
    await supabase.from("lessons").insert(inserts);
  }
  return newMod as Module;
}
export async function toggleModuleVisibility(id: number, hidden: boolean): Promise<void> {
  const { error } = await supabase.from("course_modules").update({ status: hidden ? "draft" : "published" }).eq("id", id);
  if (error) throw error;
}
export async function toggleLessonVisibility(id: number, hidden: boolean): Promise<void> {
  const { error } = await supabase.from("lessons").update({ status: hidden ? "draft" : "published" }).eq("id", id);
  if (error) throw error;
}

export { type Course, type Module, type Lesson, type PlanKey };