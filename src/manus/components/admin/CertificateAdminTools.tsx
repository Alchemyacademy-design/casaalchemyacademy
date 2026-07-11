import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, UserCheck, Loader2, AlertTriangle, CheckCircle2, LinkIcon, Copy, BarChart3, Globe, ShieldOff } from "lucide-react";
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
type CertKind = "course" | "program";

const PROGRAM_TITLE = "Alchemy Academy — Method Completion";

/* -------------------------- Shared issue helpers -------------------------- */

type IssuedState = {
  certificateId: number;
  studentName: string;
  courseTitle: string;
  issuedAt: string;
  certificateNumber: string;
  publicSlug: string | null;
};

async function invokeIssueFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-issue-certificate", { body });
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any)?.context;
    let payload: unknown = null;
    if (ctx?.body) {
      try { payload = await new Response(ctx.body).json(); } catch { /* noop */ }
    }
    throw Object.assign(new Error(error.message), { payload });
  }
  return data as Record<string, unknown>;
}

/**
 * Runs the eligibility → confirm(override) → issue flow. Returns the issued
 * state on success, or `null` when the admin cancels the override confirm.
 * Throws with a friendly error message on already_issued / other failures.
 */
async function runIssueFlow(args: {
  certKind: CertKind;
  courseId?: number;
  studentId: string;
}): Promise<IssuedState | null> {
  const { certKind, courseId, studentId } = args;
  const elig = (await invokeIssueFn({
    action: "eligibility",
    certificate_type: certKind,
    course_id: certKind === "course" ? courseId : undefined,
    student_user_id: studentId,
  })) as unknown as EligibilityResp;

  if (elig.existing_active) {
    throw new Error(
      `This student already has an active certificate (№ ${elig.existing_active.certificate_number}). Revoke it first to reissue.`,
    );
  }

  const override = !elig.report.eligible;
  if (override) {
    const r = elig.report;
    const ok = window.confirm(
      `This student has not met the standard completion criteria (${r.completion}% complete, ${r.passedQuizCount}/${r.totalPublishedQuizzes} quizzes passed). Issue anyway as a manual override?`,
    );
    if (!ok) return null;
  }

  const data = await invokeIssueFn({
    action: "issue",
    certificate_type: certKind,
    course_id: certKind === "course" ? courseId : undefined,
    student_user_id: studentId,
    allow_override: override,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cert = (data as any).certificate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (data as any).student;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (data as any).course;
  return {
    certificateId: cert.id,
    studentName: s?.name ?? "Student",
    courseTitle: c?.title ?? "Course",
    issuedAt: cert.issued_at,
    certificateNumber: cert.certificate_number,
    publicSlug: cert.public_slug ?? null,
  };
}

function IssuedResultBlock({
  issued,
  setIssued,
}: {
  issued: IssuedState;
  setIssued: (v: IssuedState) => void;
}) {
  const [generatingLink, setGeneratingLink] = useState(false);
  const [revokingLink, setRevokingLink] = useState(false);
  const verifyUrl = issued.publicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${issued.publicSlug}`
    : null;

  const setVisibility = async (makePublic: boolean) => {
    const setBusy = makePublic ? setGeneratingLink : setRevokingLink;
    setBusy(true);
    try {
      const { data, error } = await db.rpc("set_certificate_visibility", {
        p_certificate_id: issued.certificateId,
        p_make_public: makePublic,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const slug: string | null = row?.public_slug ?? null;
      setIssued({ ...issued, publicSlug: slug });
      toast.success(makePublic ? "Public link generated" : "Public link revoked");
    } catch (err) {
      console.error(err);
      toast.error(
        makePublic ? "Could not generate public link" : "Could not revoke public link",
        { description: (err as Error).message },
      );
    } finally {
      setBusy(false);
    }
  };

  const copyPublicLink = async () => {
    if (!verifyUrl) return;
    await navigator.clipboard.writeText(verifyUrl);
    toast.success("Link copied");
  };

  return (
    <>
      <div className="rounded-md border p-4 bg-emerald-50/60 space-y-3">
        <div className="text-sm font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Certificate issued · № {issued.certificateNumber}
        </div>
        {issued.publicSlug ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="px-2 py-1 rounded bg-background border text-xs break-all">
              {verifyUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyPublicLink}>
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVisibility(false)}
              disabled={revokingLink}
            >
              {revokingLink && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              <ShieldOff className="w-3 h-3 mr-1" /> Revoke public link
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setVisibility(true)} disabled={generatingLink}>
              {generatingLink && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              <LinkIcon className="w-3 h-3 mr-1" /> Generate public link
            </Button>
            <span className="text-xs text-muted-foreground">
              Certificate is currently private.
            </span>
          </div>
        )}
      </div>
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
    </>
  );
}

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

function StudentPicker({
  term, setTerm, studentId, setStudentId,
}: {
  term: string;
  setTerm: (v: string) => void;
  studentId: string;
  setStudentId: (v: string) => void;
}) {
  const students = useStudentSearch(term);
  return (
    <div>
      <Input
        value={term}
        onChange={(e) => { setTerm(e.target.value); setStudentId(""); }}
        placeholder="Type name or email (min 2 chars)…"
      />
      {students.data && students.data.length > 0 && !studentId && (
        <div className="mt-1 max-h-40 overflow-auto rounded border bg-popover text-sm shadow-sm">
          {students.data.map((s) => (
            <button
              key={s.id}
              type="button"
              className="block w-full text-left px-2 py-1.5 hover:bg-accent"
              onClick={() => { setStudentId(s.id); setTerm(s.label); }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {studentId && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Selected · {term}{" "}
          <button
            className="underline"
            onClick={() => { setStudentId(""); setTerm(""); }}
          >
            change
          </button>
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Feature 1 ------------------------------ */
function PreviewCertificatePanel({ courses }: { courses: CourseOption[] }) {
  const [studentName, setStudentName] = useState("Alex Alchemist");
  const [nameMode, setNameMode] = useState<"custom" | "registered">("custom");
  const [studentTerm, setStudentTerm] = useState("");
  const [studentId, setStudentId] = useState("");
  const [certKind, setCertKind] = useState<CertKind>("course");
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

  // When user picks a registered student, pull the display name from label
  useEffect(() => {
    if (nameMode !== "registered" || !studentTerm) return;
    // studentTerm has "Display · email" — take the first segment for the name
    const seg = studentTerm.split(" · ")[0]?.trim();
    if (seg) setStudentName(seg);
  }, [nameMode, studentTerm]);

  const handlePreview = () => {
    const name = studentName.trim() || "Alex Alchemist";
    const title =
      certKind === "program"
        ? PROGRAM_TITLE
        : (selectedCourse?.title ?? "The path to a COLOURFUL life");
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
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Certificate type</Label>
            <Select value={certKind} onValueChange={(v) => setCertKind(v as CertKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="course">Course completion</SelectItem>
                <SelectItem value="program">Total Method Completion (Academy)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {certKind === "course" && (
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
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Student</Label>
            <Select value={nameMode} onValueChange={(v) => {
              setNameMode(v as "custom" | "registered");
              if (v === "custom") { setStudentId(""); setStudentTerm(""); }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">— Custom name —</SelectItem>
                <SelectItem value="registered">Registered student</SelectItem>
              </SelectContent>
            </Select>
            {nameMode === "custom" ? (
              <Input
                className="mt-2"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Alex Alchemist"
              />
            ) : (
              <div className="mt-2">
                <StudentPicker
                  term={studentTerm}
                  setTerm={setStudentTerm}
                  studentId={studentId}
                  setStudentId={setStudentId}
                />
              </div>
            )}
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
  certificate_type: CertKind;
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
    totalCourses?: number;
    completedCourses?: number;
  };
};

function IssueCertificatePanel({ courses }: { courses: CourseOption[] }) {
  const [certKind, setCertKind] = useState<CertKind>("course");
  const [courseId, setCourseId] = useState<string>("");
  const [studentTerm, setStudentTerm] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResp | null>(null);
  const [issued, setIssued] = useState<null | {
    certificateId: number;
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
  }, [courseId, studentId, certKind]);

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
    if (!studentId) return;
    if (certKind === "course" && !courseId) return;
    setLoadingEligibility(true);
    setEligibility(null);
    setIssued(null);
    try {
      const data = (await invokeFn({
        action: "eligibility",
        certificate_type: certKind,
        course_id: certKind === "course" ? Number(courseId) : undefined,
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
        certificate_type: certKind,
        course_id: certKind === "course" ? Number(courseId) : undefined,
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
        certificateId: cert.id,
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

  const canCheck = Boolean(studentId && (certKind === "program" || courseId));
  const verifyUrl = issued?.publicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${issued.publicSlug}`
    : null;

  const handleGeneratePublicLink = async () => {
    if (!issued) return;
    setGeneratingLink(true);
    try {
      const { data, error } = await db.rpc("set_certificate_visibility", {
        p_certificate_id: issued.certificateId,
        p_make_public: true,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const slug: string | null = row?.public_slug ?? null;
      setIssued({ ...issued, publicSlug: slug });
      toast.success("Public link generated");
    } catch (err) {
      console.error(err);
      toast.error("Could not generate public link", { description: (err as Error).message });
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyPublicLink = async () => {
    if (!verifyUrl) return;
    await navigator.clipboard.writeText(verifyUrl);
    toast.success("Link copied");
  };

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
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Certificate type</Label>
            <Select value={certKind} onValueChange={(v) => setCertKind(v as CertKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="course">Course completion</SelectItem>
                <SelectItem value="program">Total Method Completion (Academy)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {certKind === "course" && (
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
          )}
          <div className="space-y-1 md:col-span-1">
            <Label>Student</Label>
            <StudentPicker
              term={studentTerm}
              setTerm={setStudentTerm}
              studentId={studentId}
              setStudentId={setStudentId}
            />
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
              {certKind === "program" ? (
                <div>
                  <div className="text-muted-foreground">Courses completed</div>
                  <div className="font-semibold">
                    {eligibility.report.completedCourses ?? 0} / {eligibility.report.totalCourses ?? 0}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-muted-foreground">Lessons published</div>
                  <div className="font-semibold">{eligibility.report.totalLessons}</div>
                </div>
              )}
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
          <>
            <div className="rounded-md border p-4 bg-emerald-50/60 space-y-3">
              <div className="text-sm font-medium text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Certificate issued · № {issued.certificateNumber}
              </div>
              {issued.publicSlug ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="px-2 py-1 rounded bg-background border text-xs break-all">
                    {verifyUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyPublicLink}>
                    <Copy className="w-3 h-3 mr-1" /> Copy
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleGeneratePublicLink} disabled={generatingLink}>
                    {generatingLink && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    <LinkIcon className="w-3 h-3 mr-1" /> Generate public link
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Certificate is currently private.
                  </span>
                </div>
              )}
            </div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Analytics ------------------------------ */

type AnalyticsRow = {
  id: number;
  certificate_number: string;
  public_slug: string;
  issued_at: string;
  revoked_at: string | null;
  student_name: string;
  course_title: string;
  view_count: number;
  last_viewed_at: string | null;
};

function useLinkAnalytics() {
  return useQuery<AnalyticsRow[]>({
    queryKey: ["admin", "certificates", "link-analytics"],
    queryFn: async () => {
      const { data: certs, error } = await db
        .from("certificates")
        .select("id,certificate_number,public_slug,issued_at,revoked_at,course_id,certificate_type,metadata,user_id")
        .not("public_slug", "is", null)
        .order("issued_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (certs ?? []) as Array<{
        id: number; certificate_number: string; public_slug: string;
        issued_at: string; revoked_at: string | null;
        course_id: number | null; certificate_type: string;
        metadata: Record<string, unknown>; user_id: string;
      }>;
      if (!list.length) return [];

      const courseIds = Array.from(new Set(list.map((c) => c.course_id).filter((v): v is number => v != null)));
      const userIds = Array.from(new Set(list.map((c) => c.user_id)));
      const certIds = list.map((c) => c.id);

      const [{ data: courses }, { data: profiles }, { data: views }] = await Promise.all([
        courseIds.length
          ? db.from("courses").select("id,title").in("id", courseIds)
          : Promise.resolve({ data: [] as Array<{ id: number; title: string }> }),
        userIds.length
          ? db.from("profiles").select("id,display_name,full_name,email").in("id", userIds)
          : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null; full_name: string | null; email: string | null }> }),
        db.from("certificate_views").select("certificate_id,viewed_at").in("certificate_id", certIds),
      ]);

      const courseMap = new Map<number, string>(
        ((courses ?? []) as Array<{ id: number; title: string }>).map((c) => [c.id, c.title]),
      );
      const profileMap = new Map<string, string>(
        ((profiles ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null; email: string | null }>)
          .map((p) => [p.id, p.display_name ?? p.full_name ?? p.email ?? "Student"]),
      );

      const viewsByCert = new Map<number, { count: number; last: string | null }>();
      for (const v of (views ?? []) as Array<{ certificate_id: number; viewed_at: string }>) {
        const entry = viewsByCert.get(v.certificate_id) ?? { count: 0, last: null };
        entry.count += 1;
        if (!entry.last || new Date(v.viewed_at) > new Date(entry.last)) entry.last = v.viewed_at;
        viewsByCert.set(v.certificate_id, entry);
      }

      const rows: AnalyticsRow[] = list.map((c) => {
        const stats = viewsByCert.get(c.id) ?? { count: 0, last: null };
        const courseTitle = c.certificate_type === "program"
          ? PROGRAM_TITLE
          : (c.course_id != null && courseMap.get(c.course_id)) || String(c.metadata?.["course_title"] ?? "Course");
        return {
          id: c.id,
          certificate_number: c.certificate_number,
          public_slug: c.public_slug,
          issued_at: c.issued_at,
          revoked_at: c.revoked_at,
          student_name: profileMap.get(c.user_id) ?? "Student",
          course_title: courseTitle,
          view_count: stats.count,
          last_viewed_at: stats.last,
        };
      });
      // Sort by views desc, then last_viewed desc
      rows.sort((a, b) => {
        if (b.view_count !== a.view_count) return b.view_count - a.view_count;
        const la = a.last_viewed_at ? new Date(a.last_viewed_at).getTime() : 0;
        const lb = b.last_viewed_at ? new Date(b.last_viewed_at).getTime() : 0;
        return lb - la;
      });
      return rows;
    },
  });
}

function PublicLinkAnalyticsPanel() {
  const { data, isLoading, error, refetch, isFetching } = useLinkAnalytics();

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-4 h-4 text-primary" /> Public link analytics
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every certificate that has a public link, with view counts. Views are recorded from the
          public <code>/c/:slug</code> page.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Refresh
          </Button>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive py-6 text-center">
            {(error as Error).message}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No public certificate links yet.
          </div>
        ) : (
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Course</th>
                  <th className="px-2 py-2">Public link</th>
                  <th className="px-2 py-2 text-right">Views</th>
                  <th className="px-2 py-2">Last viewed</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const url = `${window.location.origin}/c/${row.public_slug}`;
                  const status = row.revoked_at
                    ? { label: "Revoked", icon: <ShieldOff className="w-3 h-3" />, cls: "text-destructive" }
                    : { label: "Public", icon: <Globe className="w-3 h-3" />, cls: "text-emerald-700" };
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-2 py-2 align-top">{row.student_name}</td>
                      <td className="px-2 py-2 align-top">{row.course_title}</td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center gap-1">
                          <a
                            className="underline break-all"
                            href={`/c/${row.public_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            /c/{row.public_slug}
                          </a>
                          <button
                            type="button"
                            onClick={() => copy(url)}
                            className="p-1 hover:bg-accent rounded"
                            title="Copy link"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top text-right font-mono">{row.view_count}</td>
                      <td className="px-2 py-2 align-top">
                        {row.last_viewed_at
                          ? new Date(row.last_viewed_at).toLocaleString()
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className={`px-2 py-2 align-top ${status.cls}`}>
                        <span className="inline-flex items-center gap-1">
                          {status.icon} {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
      <PublicLinkAnalyticsPanel />
    </div>
  );
}