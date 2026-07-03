import { useState } from "react";
import { Download, Award, AlertCircle, ExternalLink, Link as LinkIcon, Linkedin } from "lucide-react";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";
import CertificateArtwork from "@/manus/components/certificates/CertificateArtwork";
import { downloadCertificatePdf } from "@/manus/components/certificates/downloadCertificatePdf";
import { toast } from "sonner";

type Props = {
  /** Course this certificate is for. When omitted the section renders nothing. */
  courseId?: number | null;
  /** Course title for the printed certificate. */
  courseTitle?: string | null;
};

export function CertificateSection({ courseId, courseTitle }: Props) {
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);

  const enabled = Number.isFinite(courseId) && (courseId ?? 0) > 0;

  const completionQuery = trpc.certificates.completionPercentage.useQuery(
    { courseId },
    { enabled },
  );
  const reportQuery = trpc.certificates.eligibilityReport.useQuery(
    { courseId },
    { enabled },
  );
  const certificateQuery = trpc.certificates.myCertificate.useQuery(
    { courseId },
    { enabled },
  );
  const issueMutation = trpc.certificates.issueCertificate.useMutation();

  if (!enabled) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Award size={20} className="text-primary" />
          <h2 className="text-xl font-serif text-foreground">Your Certificate</h2>
        </div>
        <p className="text-sm text-foreground/65">
          Select a course to view its certificate progress.
        </p>
      </div>
    );
  }

  const completion = (completionQuery.data as number | undefined) ?? 0;
  const report = reportQuery.data as
    | { eligible: boolean; missing: string[]; totalLessons: number }
    | undefined;
  const certificate = certificateQuery.data as
    | { completionPercentage?: number; issuedAt?: string; certificate_number?: string }
    | null
    | undefined;
  const isEligible = report?.eligible ?? false;

  const handleIssueCertificate = async () => {
    try {
      await issueMutation.mutateAsync({ courseId });
      certificateQuery.refetch();
    } catch (error) {
      console.error("Failed to issue certificate:", error);
    }
  };

  const publicSlug = (certificate as { public_slug?: string } | null | undefined)?.public_slug ?? null;
  const shareUrl = publicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${publicSlug}`
    : null;

  const handleDownloadCertificate = async () => {
    if (!certificate || !user) return;
    setIsDownloading(true);
    try {
      await downloadCertificatePdf({
        studentName: user.name || "Alchemist",
        courseTitle: courseTitle || "the course",
        issuedAt: certificate.issuedAt,
        certificateNumber: certificate.certificate_number || "AA-0000",
        verifyUrl: shareUrl ?? undefined,
      });
    } catch (error) {
      console.error("Failed to download certificate:", error);
      toast.error("Could not generate PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  };

  const linkedInHref = certificate && shareUrl
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
        courseTitle || "Course",
      )}&organizationName=${encodeURIComponent("Casa Alchemy Studio")}&issueYear=${new Date(
        certificate.issuedAt ?? Date.now(),
      ).getFullYear()}&issueMonth=${
        new Date(certificate.issuedAt ?? Date.now()).getMonth() + 1
      }&certUrl=${encodeURIComponent(shareUrl)}&certId=${encodeURIComponent(certificate.certificate_number || "")}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Award size={24} className="text-primary" />
        <h2 className="text-2xl font-serif text-foreground">Your Certificate</h2>
      </div>

      <div className="p-6 rounded-lg bg-muted/40">
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-foreground/80">{courseTitle || "Course"} completion</span>
            <span className="font-semibold text-primary">{completion}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>
          {report && report.missing.length > 0 && (
            <ul className="text-xs text-foreground/65 space-y-1 pt-2" role="status">
              {report.missing.map((m) => (
                <li key={m} className="flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 mt-0.5 text-amber-700" /> {m}
                </li>
              ))}
            </ul>
          )}
          {isEligible && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 pt-1">
              You are eligible to earn this certificate.
            </p>
          )}
        </div>
      </div>

      {isEligible && (
        <div className="p-6 rounded-lg bg-card border">
          {certificate ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-foreground/65 mb-1">Certificate earned</p>
                <p className="text-lg font-serif text-foreground">
                  Congratulations on completing {courseTitle || "this course"}.
                </p>
              </div>

              <CertificateArtwork
                studentName={user?.name || "Alchemist"}
                courseTitle={courseTitle || "Course"}
                issuedAt={certificate.issuedAt}
                certificateNumber={certificate.certificate_number || "AA-0000"}
                verifyUrl={shareUrl ?? undefined}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadCertificate}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 text-sm"
                >
                  <Download size={14} />
                  {isDownloading ? "Generating…" : "Download PDF"}
                </button>
                {shareUrl && (
                  <>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm hover:bg-accent"
                    >
                      <ExternalLink size={14} /> View public certificate
                    </a>
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm hover:bg-accent"
                    >
                      <LinkIcon size={14} /> Copy link
                    </button>
                    {linkedInHref && (
                      <a
                        href={linkedInHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm hover:bg-accent"
                      >
                        <Linkedin size={14} /> Add to LinkedIn
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={handleIssueCertificate}
              disabled={issueMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
            >
              <Award size={16} />
              {issueMutation.isPending ? "Issuing..." : "Issue My Certificate"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
