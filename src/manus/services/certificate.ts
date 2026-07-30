/**
 * Course-specific certificate logic.
 *
 * Replaces the prior global "first published course" approach. All functions
 * scope progress, eligibility, and issuance to a single course_id.
 *
 * Eligibility rules (pre-launch):
 *  - 100% of the course's published, non-archived lessons completed by user;
 *  - all published required quizzes for the course must be passed;
 *  - one active (non-revoked) certificate per user_id + course_id.
 */

import { supabase } from "@/integrations/supabase/client";
import { passedQuizIdsForCourse, listPublishedQuizzesForCourse } from "@/manus/services/quiz";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export type CertificateRecord = {
  id: number;
  user_id: string;
  course_id: number;
  certificate_number: string;
  issued_at: string;
  certificate_url: string | null;
  metadata: Record<string, unknown>;
  public_slug?: string | null;
  verification_hash?: string | null;
};

/** Published, non-archived lesson ids for the given course. */
async function publishedLessonIdsForCourse(courseId: number): Promise<number[]> {
  const { data: modules, error } = await db
    .from("course_modules")
    .select("id,status,archived_at,lessons(id,status,archived_at)")
    .eq("course_id", courseId)
    .eq("status", "published")
    .is("archived_at", null);
  if (error) throw error;
  const rows = (modules ?? []) as Array<{
    id: number;
    lessons: Array<{ id: number; status: string; archived_at: string | null }>;
  }>;
  return rows.flatMap((m) =>
    (m.lessons ?? [])
      .filter((l) => l.status === "published" && l.archived_at == null)
      .map((l) => l.id),
  );
}

export async function completionPercentageForCourse(courseId: number): Promise<number> {
  if (!Number.isFinite(courseId) || courseId <= 0) return 0;
  const lessonIds = await publishedLessonIdsForCourse(courseId);
  if (!lessonIds.length) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await db
    .from("lesson_progress")
    .select("lesson_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .in("lesson_id", lessonIds);
  return Math.min(100, Math.round((((count as number | null) ?? 0) / lessonIds.length) * 100));
}

export type EligibilityReport = {
  eligible: boolean;
  completion: number;
  totalLessons: number;
  totalPublishedQuizzes: number;
  passedQuizCount: number;
  missing: string[];
};

export async function eligibilityForCourse(courseId: number): Promise<EligibilityReport> {
  const lessonIds = await publishedLessonIdsForCourse(courseId);
  const totalLessons = lessonIds.length;
  const completion = await completionPercentageForCourse(courseId);
  const quizzes = await listPublishedQuizzesForCourse(courseId);
  const passed = await passedQuizIdsForCourse(courseId);
  const passedQuizCount = quizzes.filter((q) => passed.has(q.id)).length;
  const missing: string[] = [];
  if (totalLessons === 0) missing.push("This course has no published lessons yet.");
  if (completion < 100) missing.push(`Complete all lessons (currently ${completion}%).`);
  if (quizzes.length > 0 && passedQuizCount < quizzes.length) {
    missing.push(`Pass all required quizzes (${passedQuizCount}/${quizzes.length}).`);
  }
  return {
    eligible: totalLessons > 0 && completion === 100 && passedQuizCount === quizzes.length,
    completion,
    totalLessons,
    totalPublishedQuizzes: quizzes.length,
    passedQuizCount,
    missing,
  };
}

export async function myCertificateForCourse(courseId: number): Promise<CertificateRecord | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from("certificates")
    .select("*")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CertificateRecord | null) ?? null;
}

export async function issueCertificateForCourse(courseId: number): Promise<CertificateRecord> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const report = await eligibilityForCourse(courseId);
  if (!report.eligible) {
    throw new Error(report.missing[0] ?? "Not eligible for this certificate yet.");
  }
  const existing = await myCertificateForCourse(courseId);
  if (existing) return existing;
  const { data: course, error: cErr } = await db
    .from("courses")
    .select("id,title")
    .eq("id", courseId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!course) throw new Error("Course not found");

  const certificate_number = `AA-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const issued_at = new Date().toISOString();
  const { data, error } = await db
    .from("certificates")
    .insert({
      user_id: user.id,
      course_id: courseId,
      certificate_number,
      issued_at,
      metadata: {
        course_title: course.title,
        completion_percentage: report.completion,
        quiz_requirements: {
          published: report.totalPublishedQuizzes,
          passed: report.passedQuizCount,
        },
        issued_rule_version: "phase2.course_specific.v1",
      },
    })
    .select()
    .single();
  if (error) throw error;
  return data as CertificateRecord;
}

/**
 * Silent auto-issuance. Returns the existing certificate, issues a new one when
 * the learner just became eligible, or returns null when not eligible yet.
 * Never throws — it is called from background/fire-and-forget paths.
 */
export async function ensureCertificateForCourse(
  courseId: number,
): Promise<{ certificate: CertificateRecord; justIssued: boolean } | null> {
  try {
    if (!Number.isFinite(courseId) || courseId <= 0) return null;
    const existing = await myCertificateForCourse(courseId);
    if (existing) return { certificate: existing, justIssued: false };
    const report = await eligibilityForCourse(courseId);
    if (!report.eligible) return null;
    const created = await issueCertificateForCourse(courseId);
    return { certificate: created, justIssued: true };
  } catch (err) {
    console.warn("[certificates] auto-issue skipped:", err);
    return null;
  }
}
