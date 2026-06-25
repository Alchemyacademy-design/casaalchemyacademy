// quiz-access: canonical server-side helper for "can this user access this
// course's quizzes / rate this module". One single rule, reused by every
// quiz/rating function so divergence cannot creep back in.
//
// Access is granted when ANY of the following are true:
//   - admin role in public.user_roles
//   - active membership row (status='active' and not expired)
//   - active course_entitlements row for course_id (not expired)
//   - course.access_plan_keys contains 'free' or 'guest' (open-access tokens)
//   - course.access_plan_keys is empty (treated as fully open)
//
// All checks use service-role and never depend on what the browser sends.

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export type AccessDecision = {
  isAdmin: boolean;
  hasMembership: boolean;
  hasEntitlement: boolean;
  isOpenAccess: boolean;
  allowed: boolean;
};

const OPEN_TOKENS = new Set(["free", "guest"]);

export async function evaluateCourseAccess(
  admin: SupabaseLike,
  userId: string,
  courseId: number,
): Promise<AccessDecision> {
  const nowIso = new Date().toISOString();
  const [rolesRes, courseRes, membershipRes, entRes] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin"),
    admin.from("courses").select("access_plan_keys, archived_at, status").eq("id", courseId).maybeSingle(),
    admin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("ends_at", nowIso)
      .limit(1),
    admin
      .from("course_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("active", true)
      .gt("ends_at", nowIso)
      .limit(1),
  ]);

  const isAdmin = (rolesRes.data ?? []).length > 0;
  const hasMembership = (membershipRes.data ?? []).length > 0;
  const hasEntitlement = (entRes.data ?? []).length > 0;

  const accessKeys: string[] = Array.isArray(courseRes.data?.access_plan_keys)
    ? (courseRes.data.access_plan_keys as string[])
    : [];
  const isOpenAccess =
    !!courseRes.data &&
    !courseRes.data.archived_at &&
    (accessKeys.length === 0 || accessKeys.some((k) => OPEN_TOKENS.has(String(k).toLowerCase())));

  const allowed = isAdmin || hasMembership || hasEntitlement || isOpenAccess;
  return { isAdmin, hasMembership, hasEntitlement, isOpenAccess, allowed };
}

export async function isAdminUser(admin: SupabaseLike, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin");
  return (data ?? []).length > 0;
}
