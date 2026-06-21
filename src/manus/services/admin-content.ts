import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
export type ModuleRow = Database["public"]["Tables"]["course_modules"]["Row"];
export type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];

export type AdminLesson = LessonRow;
export interface AdminModule extends ModuleRow {
  lessons: AdminLesson[];
}
export interface AdminCourse extends CourseRow {
  course_modules: AdminModule[];
}

export interface AdminContentCounts {
  courses: number;
  modules: number;
  lessons: number;
  missing_video_urls: number;
  draft_courses: number;
  published_courses: number;
}

export interface AdminCatalog {
  courses: AdminCourse[];
  counts: AdminContentCounts;
  source: "edge" | "rls";
}

export class AdminContentError extends Error {
  code?: string;
  details?: string;
  hint?: string;
  source?: string;
  constructor(message: string, opts: { code?: string; details?: string; hint?: string; source?: string } = {}) {
    super(message);
    this.name = "AdminContentError";
    this.code = opts.code;
    this.details = opts.details;
    this.hint = opts.hint;
    this.source = opts.source;
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message?: unknown }).message);
  return String(err ?? "unknown error");
}

function normalizeFunctionError(source: string, err: unknown): AdminContentError {
  const e = err as { code?: string; message?: string; details?: string; hint?: string } | null | undefined;
  return new AdminContentError(`${source}: ${messageOf(err)}`, {
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
    source,
  });
}

function wrapPgError(prefix: string, err: { code?: string; message?: string; details?: string; hint?: string } | null | undefined): AdminContentError {
  return new AdminContentError(`${prefix}: ${err?.message ?? "unknown error"}`, {
    code: err?.code,
    details: err?.details ?? undefined,
    hint: err?.hint ?? undefined,
    source: "rls",
  });
}

function isPlaceholder(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.includes("/manus-storage/") || url.includes("placeholder-video");
}

function computeCounts(courses: AdminCourse[]): AdminContentCounts {
  let modules = 0;
  let lessons = 0;
  let missing = 0;
  let drafts = 0;
  let published = 0;
  for (const c of courses) {
    if (c.status === "draft") drafts++;
    if (c.status === "published") published++;
    modules += c.course_modules.length;
    for (const m of c.course_modules) {
      lessons += m.lessons.length;
      for (const l of m.lessons) if (isPlaceholder(l.external_video_url)) missing++;
    }
  }
  return {
    courses: courses.length,
    modules,
    lessons,
    missing_video_urls: missing,
    draft_courses: drafts,
    published_courses: published,
  };
}

export async function getCourses(): Promise<CourseRow[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw wrapPgError("courses", error);
  return (data ?? []) as CourseRow[];
}

export async function getCourseModules(courseIds: number[]): Promise<ModuleRow[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("course_modules")
    .select("*")
    .in("course_id", courseIds)
    .order("sort_order", { ascending: true });
  if (error) throw wrapPgError("course_modules", error);
  return (data ?? []) as ModuleRow[];
}

export async function getLessons(moduleIds: number[]): Promise<LessonRow[]> {
  if (moduleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .in("module_id", moduleIds)
    .order("sort_order", { ascending: true });
  if (error) throw wrapPgError("lessons", error);
  return (data ?? []) as LessonRow[];
}

async function getCoursesTreeViaRls(): Promise<AdminCatalog> {
  const courses = await getCourses();
  const modules = await getCourseModules(courses.map((c) => c.id));
  const lessons = await getLessons(modules.map((m) => m.id));
  const lessonsByModule = new Map<number, LessonRow[]>();
  for (const l of lessons) {
    const arr = lessonsByModule.get(l.module_id) ?? [];
    arr.push(l);
    lessonsByModule.set(l.module_id, arr);
  }
  const modulesByCourse = new Map<number, AdminModule[]>();
  for (const m of modules) {
    const arr = modulesByCourse.get(m.course_id) ?? [];
    arr.push({ ...m, lessons: lessonsByModule.get(m.id) ?? [] });
    modulesByCourse.set(m.course_id, arr);
  }
  const tree: AdminCourse[] = courses.map((c) => ({
    ...c,
    course_modules: modulesByCourse.get(c.id) ?? [],
  }));
  return { courses: tree, counts: computeCounts(tree), source: "rls" };
}

async function getCoursesTreeViaEdge(): Promise<AdminCatalog> {
  const { data, error } = await supabase.functions.invoke("admin-content-catalog", { method: "POST" });
  if (error) throw normalizeFunctionError("admin-content-catalog", error);
  if (!data || typeof data !== "object") {
    throw new AdminContentError("admin-content-catalog: empty or invalid response", { source: "admin-content-catalog" });
  }
  const payload = data as { courses?: AdminCourse[]; counts?: AdminContentCounts };
  if (!Array.isArray(payload.courses) || !payload.counts) {
    throw new AdminContentError("admin-content-catalog: response missing courses or counts", { source: "admin-content-catalog" });
  }
  return { courses: payload.courses, counts: payload.counts, source: "edge" };
}

export async function getCoursesTree(): Promise<AdminCatalog> {
  try {
    return await getCoursesTreeViaEdge();
  } catch (edgeError) {
    try {
      return await getCoursesTreeViaRls();
    } catch (rlsError) {
      const rls = rlsError as AdminContentError;
      throw new AdminContentError(`${messageOf(edgeError)}; fallback failed: ${messageOf(rlsError)}`, {
        code: rls.code,
        details: rls.details,
        hint: rls.hint,
        source: "edge+rls",
      });
    }
  }
}

export async function getAdminContentCounts(): Promise<AdminContentCounts> {
  const tree = await getCoursesTree();
  return tree.counts;
}

export async function getCourseById(id: number): Promise<AdminCourse | null> {
  const { data: course, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (error) throw wrapPgError("courses", error);
  if (!course) return null;
  const modules = await getCourseModules([course.id]);
  const lessons = await getLessons(modules.map((m) => m.id));
  const byModule = new Map<number, LessonRow[]>();
  for (const l of lessons) {
    const arr = byModule.get(l.module_id) ?? [];
    arr.push(l);
    byModule.set(l.module_id, arr);
  }
  return {
    ...(course as CourseRow),
    course_modules: modules.map((m) => ({ ...m, lessons: byModule.get(m.id) ?? [] })),
  };
}

export async function updateCourse(id: number, patch: Database["public"]["Tables"]["courses"]["Update"]) {
  const { error } = await supabase.from("courses").update(patch).eq("id", id);
  if (error) throw wrapPgError("courses.update", error);
}
export async function updateModule(id: number, patch: Database["public"]["Tables"]["course_modules"]["Update"]) {
  const { error } = await supabase.from("course_modules").update(patch).eq("id", id);
  if (error) throw wrapPgError("course_modules.update", error);
}
export async function updateLesson(id: number, patch: Database["public"]["Tables"]["lessons"]["Update"]) {
  const { error } = await supabase.from("lessons").update(patch).eq("id", id);
  if (error) throw wrapPgError("lessons.update", error);
}

export { isPlaceholder as isPlaceholderVideo };
