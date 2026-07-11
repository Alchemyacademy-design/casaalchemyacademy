// admin-issue-certificate: admin-only. Manually issues a course completion
// certificate for any student, with optional override of the standard
// eligibility rules (100% lessons + all required quizzes passed). The
// override + issuing admin id are recorded in the certificate metadata for
// audit trails.
//
// Security mirrors admin-quiz-assistant:
//  - Requires Bearer JWT
//  - Validates admin role via service-role client + user_roles
//  - 403 for non-admins

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAdminUser } from "../_shared/quiz-access.ts";

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

// deno-lint-ignore no-explicit-any
async function publishedLessonIds(admin: any, courseId: number): Promise<number[]> {
  const { data, error } = await admin
    .from("course_modules")
    .select("id,status,archived_at,lessons(id,status,archived_at)")
    .eq("course_id", courseId)
    .eq("status", "published")
    .is("archived_at", null);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    lessons: Array<{ id: number; status: string; archived_at: string | null }>;
  }>;
  return rows.flatMap((m) =>
    (m.lessons ?? [])
      .filter((l) => l.status === "published" && l.archived_at == null)
      .map((l) => l.id),
  );
}

// deno-lint-ignore no-explicit-any
async function computeEligibility(admin: any, userId: string, courseId: number) {
  const lessonIds = await publishedLessonIds(admin, courseId);
  const totalLessons = lessonIds.length;

  let completed = 0;
  if (totalLessons > 0) {
    const { count } = await admin
      .from("lesson_progress")
      .select("lesson_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .in("lesson_id", lessonIds);
    completed = (count as number | null) ?? 0;
  }
  const completion = totalLessons ? Math.min(100, Math.round((completed / totalLessons) * 100)) : 0;

  // Published quizzes for the course (all treated as required — matches
  // the client-side eligibilityForCourse logic).
  const { data: quizzes } = await admin
    .from("quizzes")
    .select("id,course_id,status")
    .eq("course_id", courseId)
    .eq("status", "published");
  const requiredQuizIds = ((quizzes ?? []) as Array<{ id: number }>).map((q) => q.id);

  let passedRequired = 0;
  if (requiredQuizIds.length) {
    const { data: attempts } = await admin
      .from("quiz_attempts")
      .select("quiz_id,passed")
      .eq("user_id", userId)
      .in("quiz_id", requiredQuizIds)
      .eq("passed", true);
    const passedSet = new Set(
      ((attempts ?? []) as Array<{ quiz_id: number }>).map((a) => a.quiz_id),
    );
    passedRequired = passedSet.size;
  }

  const eligible =
    totalLessons > 0 && completion === 100 && passedRequired === requiredQuizIds.length;

  return {
    eligible,
    completion,
    totalLessons,
    totalPublishedQuizzes: requiredQuizIds.length,
    passedQuizCount: passedRequired,
  };
}

function certificateNumber(): string {
  const year = new Date().getUTCFullYear();
  return `AA-${year}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

// deno-lint-ignore no-explicit-any
async function computeProgramEligibility(admin: any, userId: string) {
  // All published, non-archived courses in the Academy
  const { data: courses, error } = await admin
    .from("courses")
    .select("id,title,status,archived_at")
    .eq("status", "published")
    .is("archived_at", null);
  if (error) throw error;
  const list = (courses ?? []) as Array<{ id: number; title: string }>;

  const perCourse: Array<{
    id: number; title: string;
    completion: number; totalLessons: number;
    totalPublishedQuizzes: number; passedQuizCount: number; eligible: boolean;
  }> = [];
  for (const c of list) {
    const r = await computeEligibility(admin, userId, c.id);
    perCourse.push({ id: c.id, title: c.title, ...r });
  }
  const totalCourses = perCourse.length;
  const completedCourses = perCourse.filter((p) => p.eligible).length;
  const eligible = totalCourses > 0 && completedCourses === totalCourses;
  // Aggregate completion (avg) purely for display
  const completion =
    totalCourses > 0
      ? Math.round(perCourse.reduce((s, p) => s + p.completion, 0) / totalCourses)
      : 0;
  const totalPublishedQuizzes = perCourse.reduce((s, p) => s + p.totalPublishedQuizzes, 0);
  const passedQuizCount = perCourse.reduce((s, p) => s + p.passedQuizCount, 0);
  const totalLessons = perCourse.reduce((s, p) => s + p.totalLessons, 0);
  return {
    eligible,
    completion,
    totalLessons,
    totalPublishedQuizzes,
    passedQuizCount,
    totalCourses,
    completedCourses,
    perCourse,
  };
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
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
  const adminUserId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE);
  if (!(await isAdminUser(admin, adminUserId))) return json({ error: "forbidden" }, 403);

  let payload: {
    action?: string;
    course_id?: number;
    student_user_id?: string;
    allow_override?: boolean;
    certificate_type?: string;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = payload.action === "issue" ? "issue" : "eligibility";
  const certType = payload.certificate_type === "program" ? "program" : "course";
  const courseId = certType === "course" ? Number(payload.course_id) : 0;
  const studentId = String(payload.student_user_id ?? "");
  if (certType === "course" && (!Number.isFinite(courseId) || courseId <= 0)) {
    return json({ error: "invalid_course_id" }, 400);
  }
  if (!studentId) return json({ error: "invalid_student_id" }, 400);

  const { data: student } = await admin
    .from("profiles")
    .select("id,full_name,display_name,email")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return json({ error: "student_not_found" }, 404);

  let course: { id: number; title: string } | null = null;
  if (certType === "course") {
    const { data: c } = await admin
      .from("courses").select("id,title").eq("id", courseId).maybeSingle();
    if (!c) return json({ error: "course_not_found" }, 404);
    course = c;
  }

  // Look up existing active certificate of the SAME type
  let existingQuery = admin
    .from("certificates")
    .select("id,certificate_number,issued_at,public_slug,revoked_at,metadata,course_id,certificate_type")
    .eq("user_id", studentId)
    .eq("certificate_type", certType)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false })
    .limit(1);
  if (certType === "course") existingQuery = existingQuery.eq("course_id", courseId);
  else existingQuery = existingQuery.is("course_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  // deno-lint-ignore no-explicit-any
  const report: any =
    certType === "program"
      ? await computeProgramEligibility(admin, studentId)
      : await computeEligibility(admin, studentId, courseId);

  if (action === "eligibility") {
    const courseLabel = certType === "program"
      ? { id: 0, title: "Alchemy Academy — Method Completion" }
      : { id: course!.id, title: course!.title };
    return json({
      course: courseLabel,
      certificate_type: certType,
      student: {
        id: student.id,
        name: student.display_name ?? student.full_name ?? student.email ?? "Student",
        email: student.email,
      },
      existing_active: existing ?? null,
      report,
    });
  }

  // action === "issue"
  if (existing) {
    return json({ error: "already_issued", existing }, 409);
  }

  const override = !report.eligible;
  if (override && !payload.allow_override) {
    return json({ error: "not_eligible", report }, 412);
  }

  const cert_number = certificateNumber();
  const issued_at = new Date().toISOString();
  const insertRow: Record<string, unknown> = {
    user_id: studentId,
    certificate_number: cert_number,
    issued_at,
    certificate_type: certType,
    metadata: {
      course_title: certType === "program"
        ? "Alchemy Academy — Method Completion"
        : course!.title,
      completion_percentage: report.completion,
      quiz_requirements: {
        published: report.totalPublishedQuizzes,
        passed: report.passedQuizCount,
      },
      issued_by: "admin_manual",
      admin_user_id: adminUserId,
      overridden_eligibility: override,
      certificate_type: certType,
      program_summary: certType === "program"
        ? { totalCourses: report.totalCourses, completedCourses: report.completedCourses }
        : undefined,
      issued_rule_version: certType === "program"
        ? "program.admin_manual.v1"
        : "phase2.admin_manual.v1",
    },
  };
  if (certType === "course") insertRow.course_id = courseId;
  const { data, error } = await admin
    .from("certificates")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    console.error("[admin-issue-certificate] insert failed", error);
    return json({ error: "insert_failed", detail: error.message }, 500);
  }

  return json({
    certificate: data,
    student: {
      id: student.id,
      name: student.display_name ?? student.full_name ?? student.email ?? "Student",
    },
    course: certType === "program"
      ? { id: 0, title: "Alchemy Academy — Method Completion" }
      : { id: course!.id, title: course!.title },
    certificate_type: certType,
    override,
  });
});