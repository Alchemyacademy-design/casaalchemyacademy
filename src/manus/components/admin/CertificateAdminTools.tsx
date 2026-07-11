import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, UserCheck, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/manus/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import CertificatePortfolioLayout from "@/manus/components/certificates/CertificatePortfolioLayout";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

type CourseOption = { id: number; title: string };
type StudentOption = { id: string; label: string; email: string | null };

function useAdminCourses() {
  return useQuery<CourseOption[]>({
    queryKey: ["admin", "certificates", "courses"],
    queryFn: async () => {
      const { data, error } = await db
        .from("courses")
        .select("id,title,status,archived_at")
        .is("archived_at", null)
        .order("title", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((c: { id: number; title: string }) => ({ id: c.id, title: c.title }));
    },
  });
}

function useStudentSearch(term: string) {
  const q = term.trim();
  return useQuery<StudentOption[]>({
    queryKey: ["admin", "certificates", "student-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const like = `%${q}%`;
      const { data, error } = await db
        .from("profiles")
        .select("id,full_name,display_name,email")
        .or(`full_name.ilike.${like},display_name.ilike.${like},email.ilike.${like}`)
        .limit(15);
      if (error) throw error;
      return (data ?? []).map((p: {
        id: string; full_name: string | null; display_name: string | null; email: string | null;
      }) => ({
        id: p.id,
        email: p.email,
        label: [p.display_name ?? p.full_name ?? "Student", p.email].filter(Boolean).join(" · "),
      }));
    },
  });
}

/* ------------------------------ Feature 1 ------------------------------ */
function PreviewCertificatePanel({ courses }: { courses: CourseOption[] }) {
  const [studentName, setStudentName] = useState("Alex Alchemist");
  const [courseId, setCourseId] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<null | {
    studentName: string;
    courseTitle: string;
    issuedAt: string;
    certificateNumber: string;
  }>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c.id) === courseId),
    [courses, courseId],
  );

  const handlePreview = () => {
    const name = studentName.trim() || "Alex Alchemist";
    const title = selectedCourse?.title ?? "The path to a COLOURFUL life";
    const dt = issueDate ? new Date(issueDate + "T12:00:00Z") : new Date();
    setPreview({
      studentName: name,
      courseTitle: title,
      issuedAt: dt.toISOString(),
      certificateNumber: "AA-PREVIEW-0000",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" /> Preview certificate
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Render-only. Uses whatever you type — <strong>nothing is saved</strong>, no row is added
          to <code>certificates</code>, no slug is generated.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="prev-name">Student name</Label>
            <Input
              id="prev-name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Alex Alchemist"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="prev-course">Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger id="prev-course">
                <SelectValue placeholder="Select a course…" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="prev-date">Issue date</Label>
            <Input
              id="prev-date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePreview} size="sm">
            <Sparkles className="w-3 h-3 mr-1" /> Preview certificate
          </Button>
          {preview && (
            <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
              Clear preview
            </Button>
          )}
        </div>

        {preview && (
          <div className="rounded-md overflow-hidden border">
            <CertificatePortfolioLayout
              studentName={preview.studentName}
              courseTitle={preview.courseTitle}
              issuedAt={preview.issuedAt}
              certificateNumber={preview.certificateNumber}
              previewBanner
              showTopBar={false}
              showLinkedIn={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Feature 2 ------------------------------ */

type EligibilityResp = {
  course: { id: number; title: string };
  student: { id: string; name: string; email: string | null };
  existing_active: null | {
    id: number;
    certificate_number: string;
    issued_at: string;
    public_slug: string | null;
  };
  report: {
    eligible: boolean;
    completion: number;
    totalLessons: number;
    totalPublishedQuizzes: number;
    passedQuizCount: number;
  };
};

function IssueCertificatePanel({ courses }: { courses: CourseOption[] }) {
  const [courseId, setCourseId] = useState<string>("");
  const [studentTerm, setStudentTerm] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const students = useStudentSearch(studentTerm);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResp | null>(null);
  const [issued, setIssued] = useState<null | {
    studentName: string;
    courseTitle: string;
    issuedAt: string;
    certificateNumber: string;
    publicSlug: string | null;
  }>(null);

  // reset eligibility when selection changes
  useEffect(() => {
    setEligibility(null);
    setIssued(null);
  }, [courseId, studentId]);

  const invokeFn = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-issue-certificate", { body });
    if (error) {
      // supabase-js wraps HTTP errors; try to fish the body message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any)?.context;
      let payload: unknown = null;
      if (ctx?.body) {
        try { payload = await new Response(ctx.body).json(); } catch { /* noop */ }
      }
      throw Object.assign(new Error(error.message), { payload });
    }
    return data as Record<string, unknown>;
  };

  const handleCheck = async () => {
    if (!courseId || !studentId) return;
    setLoadingEligibility(true);
    setEligibility(null);
    setIssued(null);
    try {
      const data = (await invokeFn({
        action: "eligibility",
        course_id: Number(courseId),
        student_user_id: studentId,
      })) as unknown as EligibilityResp;
      setEligibility(data);
    } catch (err) {
      console.error(err);
      toast.error("Could not load eligibility", { description: (err as Error).message });
    } finally {
      setLoadingEligibility(false);
    }
  };

  const handleIssue = async () => {
    if (!eligibility || eligibility.existing_active) return;
    const override = !eligibility.report.eligible;
    if (override) {
      const r = eligibility.report;
      const ok = window.confirm(
        `This student has not met the standard completion criteria (${r.completion}% complete, ${r.passedQuizCount}/${r.totalPublishedQuizzes} quizzes passed). Issue anyway as a manual override?`,
      );
      if (!ok) return;
    }
    setIssuing(true);
    try {
      const data = await invokeFn({
        action: "issue",
        course_id: Number(courseId),
        student_user_id: studentId,
        allow_override: override,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cert = (data as any).certificate;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (data as any).student;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (data as any).course;
      setIssued({
        studentName: s?.name ?? "Student",
        courseTitle: c?.title ?? "Course",
        issuedAt: cert.issued_at,
        certificateNumber: cert.certificate_number,
        publicSlug: cert.public_slug ?? null,
      });
      toast.success(override ? "Certificate issued (manual override)" : "Certificate issued");
      // refresh eligibility so existing_active updates
      handleCheck();
    } catch (err) {
      console.error(err);
      toast.error("Could not issue certificate", { description: (err as Error).message });
    } finally {
      setIssuing(false);
    }
  };

  const canCheck = Boolean(courseId && studentId);
  const verifyUrl = issued?.publicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${issued.publicSlug}`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="w-4 h-4 text-primary" /> Issue certificate for student
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Manually award a certificate to a specific student. Eligibility is computed the same way
          the auto-issue flow does, and any override is recorded in the certificate metadata.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select a course…" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Student</Label>
            <Input
              value={studentTerm}
              onChange={(e) => { setStudentTerm(e.target.value); setStudentId(""); }}
              placeholder="Type name or email (min 2 chars)…"
            />
            {students.data && students.data.length > 0 && !studentId && (
              <div className="mt-1 max-h-40 overflow-auto rounded border bg-popover text-sm shadow-sm">
                {students.data.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="block w-full text-left px-2 py-1.5 hover:bg-accent"
                    onClick={() => { setStudentId(s.id); setStudentTerm(s.label); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {studentId && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Selected · {studentTerm}{" "}
                <button
                  className="underline"
                  onClick={() => { setStudentId(""); setStudentTerm(""); }}
                >
                  change
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleCheck} disabled={!canCheck || loadingEligibility}>
            {loadingEligibility && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Check eligibility
          </Button>
        </div>

        {eligibility && (
          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
            <div className="text-sm">
              <strong>{eligibility.student.name}</strong>{" "}
              <span className="text-muted-foreground">· {eligibility.course.title}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Completion</div>
                <div className="font-semibold">{eligibility.report.completion}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Lessons published</div>
                <div className="font-semibold">{eligibility.report.totalLessons}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Required quizzes</div>
                <div className="font-semibold">
                  {eligibility.report.passedQuizCount} / {eligibility.report.totalPublishedQuizzes}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Eligible?</div>
                <div className="font-semibold">
                  {eligibility.report.eligible ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-amber-700 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> No
                    </span>
                  )}
                </div>
              </div>
            </div>

            {eligibility.existing_active ? (
              <div className="rounded border bg-background p-3 text-sm">
                This student already has an active certificate for this course
                {" "}(№ <strong>{eligibility.existing_active.certificate_number}</strong>, issued{" "}
                {new Date(eligibility.existing_active.issued_at).toLocaleDateString()}).
                Revoke it first if you need to reissue.
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleIssue} disabled={issuing}>
                  {issuing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {eligibility.report.eligible ? "Issue certificate" : "Issue anyway (override)"}
                </Button>
              </div>
            )}
          </div>
        )}

        {issued && (
          <div className="rounded-md overflow-hidden border">
            <CertificatePortfolioLayout
              studentName={issued.studentName}
              courseTitle={issued.courseTitle}
              issuedAt={issued.issuedAt}
              certificateNumber={issued.certificateNumber}
              verifyUrl={verifyUrl}
              showTopBar={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Wrapper ------------------------------ */
export default function CertificateAdminTools() {
  const { isAdmin } = useAuth();
  const courses = useAdminCourses();

  if (!isAdmin) return null;
  const list = courses.data ?? [];

  return (
    <div className="space-y-4 mb-6">
      <PreviewCertificatePanel courses={list} />
      <IssueCertificatePanel courses={list} />
    </div>
  );
}