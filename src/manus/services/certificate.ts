/**
 * Course-specific certificate logic — server-authoritative.
 *
 * All eligibility checks and issuance happen inside Postgres SECURITY DEFINER
 * functions (`my_certificate_status`, `issue_my_certificate`). The client can
 * never insert into `public.certificates`: there is no student INSERT policy.
 *
 * Issuance is idempotent and race-safe: `issue_my_certificate` takes a
 * transaction advisory lock on (user, course) and relies on the
 * `certificates_user_id_course_id_key` unique index, so concurrent calls always
 * converge on a single row.
 */

import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export type CertificateRecord = {
  id: number;
  certificate_number: string;
  issued_at: string;
  issuedAt?: string;
  public_slug?: string | null;
  verification_hash?: string | null;
  certificate_type?: string;
  metadata?: Record<string, unknown>;
};

export type CertificateStatus = {
  course_id: number;
  course_title?: string;
  cover_image_path?: string | null;
  status: "pending" | "issued";
  eligible: boolean;
  completion: number;
  total_lessons: number;
  completed_lessons: number;
  total_quizzes: number;
  passed_quizzes: number;
  missing: string[];
  certificate: CertificateRecord | null;
};

function normalize(raw: unknown): CertificateStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const cert = (r.certificate ?? null) as CertificateRecord | null;
  return {
    course_id: Number(r.course_id ?? 0),
    course_title: (r.course_title as string | undefined) ?? undefined,
    cover_image_path: (r.cover_image_path as string | null | undefined) ?? null,
    status: r.status === "issued" ? "issued" : "pending",
    eligible: Boolean(r.eligible),
    completion: Number(r.completion ?? 0),
    total_lessons: Number(r.total_lessons ?? 0),
    completed_lessons: Number(r.completed_lessons ?? 0),
    total_quizzes: Number(r.total_quizzes ?? 0),
    passed_quizzes: Number(r.passed_quizzes ?? 0),
    missing: Array.isArray(r.missing) ? (r.missing as string[]) : [],
    certificate: cert ? { ...cert, issuedAt: cert.issued_at } : null,
  };
}

export async function certificateStatusForCourse(
  courseId: number,
): Promise<CertificateStatus | null> {
  if (!Number.isFinite(courseId) || courseId <= 0) return null;
  const { data, error } = await db.rpc("my_certificate_status", { p_course_id: courseId });
  if (error) throw error;
  return normalize(data);
}

export async function myCertificatesOverview(): Promise<CertificateStatus[]> {
  const { data, error } = await db.rpc("my_certificates_overview");
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map(normalize).filter((r): r is CertificateStatus => r !== null);
}

export async function completionPercentageForCourse(courseId: number): Promise<number> {
  const status = await certificateStatusForCourse(courseId);
  return status?.completion ?? 0;
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
  const s = await certificateStatusForCourse(courseId);
  if (!s) {
    return {
      eligible: false,
      completion: 0,
      totalLessons: 0,
      totalPublishedQuizzes: 0,
      passedQuizCount: 0,
      missing: ["This course has no published lessons yet."],
    };
  }
  return {
    eligible: s.eligible,
    completion: s.completion,
    totalLessons: s.total_lessons,
    totalPublishedQuizzes: s.total_quizzes,
    passedQuizCount: s.passed_quizzes,
    missing: s.missing,
  };
}

export async function myCertificateForCourse(courseId: number): Promise<CertificateRecord | null> {
  const s = await certificateStatusForCourse(courseId);
  return s?.certificate ?? null;
}

/** Idempotent server-side issuance. Throws when the learner is not eligible. */
export async function issueCertificateForCourse(courseId: number): Promise<CertificateRecord> {
  if (!Number.isFinite(courseId) || courseId <= 0) throw new Error("Invalid course");
  const { data, error } = await db.rpc("issue_my_certificate", { p_course_id: courseId });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("not_eligible")) throw new Error("Not eligible for this certificate yet.");
    if (msg.includes("unauthorized")) throw new Error("Authentication required");
    throw error;
  }
  const status = normalize(data);
  if (!status?.certificate) throw new Error("Certificate could not be issued.");
  return status.certificate;
}

/**
 * Silent auto-issuance used by background paths (finishing a lesson/quiz).
 * Never throws; safe to call repeatedly thanks to server-side idempotency.
 */
export async function ensureCertificateForCourse(
  courseId: number,
): Promise<{ certificate: CertificateRecord; justIssued: boolean } | null> {
  try {
    if (!Number.isFinite(courseId) || courseId <= 0) return null;
    const { data, error } = await db.rpc("issue_my_certificate", { p_course_id: courseId });
    if (error) return null;
    const status = normalize(data);
    if (!status?.certificate) return null;
    const justIssued = Boolean((data as Record<string, unknown>)?.just_issued);
    return { certificate: status.certificate, justIssued };
  } catch (err) {
    console.warn("[certificates] auto-issue skipped:", err);
    return null;
  }
}
