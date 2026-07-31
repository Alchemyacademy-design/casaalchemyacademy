import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, Clock, Download, ExternalLink, Loader2 } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/manus/hooks/useAuth";
import { myCertificatesOverview, type CertificateStatus } from "@/manus/services/certificate";
import { downloadCertificatePdf } from "@/manus/components/certificates/downloadCertificatePdf";

function StatusPill({ status }: { status: CertificateStatus["status"] }) {
  const issued = status === "issued";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${
        issued
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      }`}
    >
      {issued ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {issued ? "Issued" : "Pending"}
    </span>
  );
}

function CertificateCard({ row, studentName }: { row: CertificateStatus; studentName: string }) {
  const [downloading, setDownloading] = useState(false);
  const cert = row.certificate;
  const shareUrl = cert?.public_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${cert.public_slug}`
    : null;

  return (
    <article className="rounded-lg border bg-card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-foreground">{row.course_title ?? "Course"}</h2>
          <p className="text-xs text-foreground/60">
            {row.completed_lessons}/{row.total_lessons} lessons
            {row.total_quizzes > 0 ? ` · ${row.passed_quizzes}/${row.total_quizzes} quizzes` : ""}
          </p>
        </div>
        <StatusPill status={row.status} />
      </header>

      <div className="space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${row.completion}%` }} />
        </div>
        <p className="text-xs text-foreground/60">{row.completion}% complete</p>
      </div>

      {cert ? (
        <div className="space-y-3">
          <p className="text-xs text-foreground/70">
            Certificate № {cert.certificate_number} · issued{" "}
            {new Date(cert.issued_at).toLocaleDateString()}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadCertificatePdf({
                    studentName,
                    courseTitle: row.course_title ?? "Course",
                    issuedAt: cert.issued_at,
                    certificateNumber: cert.certificate_number,
                    verifyUrl: shareUrl ?? undefined,
                  });
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
              Download PDF
            </Button>
            {shareUrl && (
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Public page
                </Button>
              </a>
            )}
            <Link to={`/courses/${row.course_id}`}>
              <Button size="sm" variant="ghost">Open course</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1 text-xs text-foreground/65">
            {(row.missing.length ? row.missing : ["Finish the course to unlock your certificate."]).map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
          <Link to={`/courses/${row.course_id}`}>
            <Button size="sm" variant="outline">Continue course</Button>
          </Link>
        </div>
      )}
    </article>
  );
}

export default function Certificates() {
  const { user, isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ["certificates.overview"],
    queryFn: myCertificatesOverview,
    enabled: isAuthenticated,
  });

  const rows = query.data ?? [];
  const issued = rows.filter((r) => r.status === "issued");

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h1 className="font-serif text-2xl text-foreground">Your certificates</h1>
          </div>
          <p className="text-sm text-foreground/65">
            Certificates are released automatically by the Academy once every lesson and required
            quiz of a course is completed. {issued.length} issued · {rows.length - issued.length} pending.
          </p>
        </header>

        {query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your certificates…
          </div>
        )}
        {query.isError && (
          <p className="text-sm text-destructive">We could not load your certificates right now.</p>
        )}
        {!query.isLoading && !query.isError && rows.length === 0 && (
          <p className="text-sm text-foreground/65">
            No courses available yet. Once you join a course it will appear here.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <CertificateCard key={row.course_id} row={row} studentName={user?.name || "Alchemist"} />
          ))}
        </div>
      </div>
    </MemberLayout>
  );
}
