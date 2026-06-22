/**
 * Single source of truth for client-side course access decisions and
 * lesson-progress derived values. The RLS in Supabase is authoritative —
 * this helper exists only so the UI does not over-block (or over-grant)
 * rows the server already filtered.
 */

export type AccessState = {
  isAdmin: boolean;
  isMember: boolean;
  hasCourseAccess: boolean;
  entitlementCourseIds: number[];
};

export function canAccessCourse(
  courseId: number | string,
  accessPlanKeys: string[] | null | undefined,
  access: AccessState,
): boolean {
  if (access.isAdmin) return true;
  const keys = accessPlanKeys ?? [];
  // free / guest course — open to anyone the RLS already let through
  if (keys.length === 0 || keys.includes("free") || keys.includes("guest")) return true;
  if (access.isMember) return true;
  const cid = Number(courseId);
  if (Number.isFinite(cid) && access.entitlementCourseIds.includes(cid)) return true;
  return false;
}

export type LessonStatus = "not_started" | "in_progress" | "completed";

export function lessonStatusFromPercent(pct: number): LessonStatus {
  if (pct >= 100) return "completed";
  if (pct > 0) return "in_progress";
  return "not_started";
}

export type SimpleProgress = {
  lessonId: number;
  moduleId?: number;
  completed: boolean;
  last_watched_at?: string | null;
};

/** % of completed lessons over total. Returns 0 when total is 0. */
export function courseProgressPercent(
  moduleIds: ReadonlyArray<number>,
  totalLessons: number,
  progress: ReadonlyArray<SimpleProgress>,
): number {
  if (totalLessons <= 0) return 0;
  const set = new Set(moduleIds);
  const done = progress.filter((p) => p.completed && (p.moduleId == null || set.has(p.moduleId))).length;
  return Math.min(100, Math.round((done / totalLessons) * 100));
}

/** Find the next lesson to resume: most recent watched > first incomplete. */
export function pickResumeLessonId<T extends { id: number }>(
  orderedLessons: ReadonlyArray<T>,
  progress: ReadonlyArray<SimpleProgress>,
): number | null {
  if (orderedLessons.length === 0) return null;
  const lastWatched = progress
    .filter((p) => !!p.last_watched_at)
    .sort((a, b) => String(b.last_watched_at).localeCompare(String(a.last_watched_at)))[0];
  if (lastWatched && orderedLessons.some((l) => l.id === lastWatched.lessonId)) {
    return lastWatched.lessonId;
  }
  const doneIds = new Set(progress.filter((p) => p.completed).map((p) => p.lessonId));
  const firstIncomplete = orderedLessons.find((l) => !doneIds.has(l.id));
  return (firstIncomplete ?? orderedLessons[0]).id;
}
