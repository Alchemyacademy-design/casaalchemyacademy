/**
 * End-to-end-ish certificate tests.
 *
 * They simulate a learner finishing every lesson and quiz of a course against a
 * fake Postgres implementation of the server-side RPCs, and assert that:
 *  - the certificate is issued ONLY through `issue_my_certificate` (never a
 *    client-side insert into `public.certificates`);
 *  - issuance is idempotent (repeated calls return the same certificate);
 *  - concurrent calls (race) never create duplicates.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type Cert = {
  id: number;
  certificate_number: string;
  issued_at: string;
  public_slug: string;
  verification_hash: string;
  certificate_type: string;
  metadata: Record<string, unknown>;
};

// Fake server state — mirrors the SQL functions added in the migration.
const server = {
  totalLessons: 3,
  completedLessons: 0,
  totalQuizzes: 1,
  passedQuizzes: 0,
  certs: new Map<number, Cert>(), // keyed by course_id (single test user)
  seq: 0,
  lockHeld: false,
};

function eligibility() {
  const completion = server.totalLessons
    ? Math.min(100, Math.round((server.completedLessons / server.totalLessons) * 100))
    : 0;
  return {
    eligible:
      server.totalLessons > 0 && completion === 100 && server.passedQuizzes === server.totalQuizzes,
    completion,
    total_lessons: server.totalLessons,
    completed_lessons: server.completedLessons,
    total_quizzes: server.totalQuizzes,
    passed_quizzes: server.passedQuizzes,
  };
}

function status(courseId: number) {
  const e = eligibility();
  const cert = server.certs.get(courseId) ?? null;
  const missing: string[] = [];
  if (e.total_lessons === 0) missing.push("This course has no published lessons yet.");
  if (e.completion < 100) missing.push(`Complete all lessons (currently ${e.completion}%).`);
  if (e.total_quizzes > 0 && e.passed_quizzes < e.total_quizzes) {
    missing.push(`Pass all required quizzes (${e.passed_quizzes}/${e.total_quizzes}).`);
  }
  return {
    ...e,
    course_id: courseId,
    status: cert ? "issued" : "pending",
    missing,
    certificate: cert,
  };
}

const insertSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (name === "my_certificate_status") {
      return { data: status(Number(args?.p_course_id)), error: null };
    }
    if (name === "my_certificates_overview") {
      return { data: [{ ...status(1), course_title: "Course 1" }], error: null };
    }
    if (name === "issue_my_certificate") {
      const courseId = Number(args?.p_course_id);
      // Advisory lock: concurrent callers are serialized.
      if (server.lockHeld) throw new Error("lock contention should be impossible");
      server.lockHeld = true;
      try {
        const existing = server.certs.get(courseId);
        if (existing) return { data: { ...status(courseId), just_issued: false }, error: null };
        if (!eligibility().eligible) {
          return { data: null, error: { message: "not_eligible" } };
        }
        server.seq += 1;
        server.certs.set(courseId, {
          id: server.seq,
          certificate_number: `AA-2026-000${server.seq}`,
          issued_at: new Date().toISOString(),
          public_slug: `aa-000${server.seq}`,
          verification_hash: `hash${server.seq}`,
          certificate_type: "course",
          metadata: { completion_percentage: 100 },
        });
        return { data: { ...status(courseId), just_issued: true }, error: null };
      } finally {
        server.lockHeld = false;
      }
    }
    return { data: null, error: { message: `unknown rpc ${name}` } };
  });

  return {
    supabase: {
      rpc,
      from: vi.fn(() => ({ insert: insertSpy })),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    },
  };
});

import {
  certificateStatusForCourse,
  completionPercentageForCourse,
  eligibilityForCourse,
  ensureCertificateForCourse,
  issueCertificateForCourse,
  myCertificatesOverview,
} from "@/manus/services/certificate";

afterEach(() => {
  server.completedLessons = 0;
  server.passedQuizzes = 0;
  server.certs.clear();
  server.seq = 0;
  insertSpy.mockClear();
});

describe("certificate status", () => {
  it("returns 0 for an invalid courseId without hitting the server", async () => {
    expect(await completionPercentageForCourse(0)).toBe(0);
    expect(await completionPercentageForCourse(-1)).toBe(0);
  });

  it("reports pending with the missing requirements while the course is unfinished", async () => {
    server.completedLessons = 1;
    const s = await certificateStatusForCourse(1);
    expect(s?.status).toBe("pending");
    expect(s?.certificate).toBeNull();
    expect(s?.completion).toBe(33);
    expect(s?.missing.join(" ")).toMatch(/Complete all lessons/);
    expect(s?.missing.join(" ")).toMatch(/Pass all required quizzes/);
  });
});

describe("end-to-end course completion", () => {
  it("issues the certificate only after every lesson and quiz is done, via the server function", async () => {
    // Watch lessons one by one — still not eligible.
    for (let i = 1; i <= 3; i += 1) {
      server.completedLessons = i;
      expect((await eligibilityForCourse(1)).eligible).toBe(false);
      expect(await ensureCertificateForCourse(1)).toBeNull();
    }
    // Pass the required quiz — now eligible.
    server.passedQuizzes = 1;
    const report = await eligibilityForCourse(1);
    expect(report.eligible).toBe(true);

    const result = await ensureCertificateForCourse(1);
    expect(result?.justIssued).toBe(true);
    expect(result?.certificate.certificate_number).toBe("AA-2026-0001");

    const s = await certificateStatusForCourse(1);
    expect(s?.status).toBe("issued");

    // Never a direct client-side insert into public.certificates.
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("is idempotent — repeated issuance returns the same certificate", async () => {
    server.completedLessons = 3;
    server.passedQuizzes = 1;
    const first = await issueCertificateForCourse(1);
    const second = await issueCertificateForCourse(1);
    const third = await ensureCertificateForCourse(1);
    expect(second.id).toBe(first.id);
    expect(third?.justIssued).toBe(false);
    expect(server.certs.size).toBe(1);
  });

  it("survives a race: concurrent submissions create exactly one certificate", async () => {
    server.completedLessons = 3;
    server.passedQuizzes = 1;
    const results = await Promise.all([
      ensureCertificateForCourse(1),
      ensureCertificateForCourse(1),
      ensureCertificateForCourse(1),
      issueCertificateForCourse(1),
    ]);
    expect(server.certs.size).toBe(1);
    const numbers = new Set(
      results.map((r) => (r && "certificate" in r ? r.certificate.certificate_number : r?.certificate_number)),
    );
    expect(numbers.size).toBe(1);
  });

  it("refuses issuance when not eligible", async () => {
    server.completedLessons = 2;
    await expect(issueCertificateForCourse(1)).rejects.toThrow(/Not eligible/);
    expect(server.certs.size).toBe(0);
  });
});

describe("overview", () => {
  it("lists per-course status for the certificates screen", async () => {
    const rows = await myCertificatesOverview();
    expect(rows).toHaveLength(1);
    expect(rows[0].course_title).toBe("Course 1");
    expect(rows[0].status).toBe("pending");
  });
});
