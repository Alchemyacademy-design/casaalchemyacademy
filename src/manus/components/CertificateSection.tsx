import { useState } from "react";
import { Download, Award, AlertCircle } from "lucide-react";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";

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

  const handleDownloadCertificate = async () => {
    if (!certificate || !user) return;
    setIsDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#F5F0E8"; // cream
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#C4A05A"; // gold
      ctx.lineWidth = 8;
      ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
      ctx.textAlign = "center";
      ctx.fillStyle = "#3D3A2A"; // olive
      ctx.font = 'bold 60px "Cormorant Garamond", Georgia, serif';
      ctx.fillText("Certificate of Completion", canvas.width / 2, 150);
      ctx.font = '24px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = "#5C5840";
      ctx.fillText("Alchemy Academy", canvas.width / 2, 220);
      ctx.fillStyle = "#3D3A2A";
      ctx.font = '18px "DM Sans", system-ui, sans-serif';
      ctx.fillText("This certifies that", canvas.width / 2, 320);
      ctx.fillStyle = "#C4A05A";
      ctx.font = 'bold 36px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(user.name || "Alchemist", canvas.width / 2, 400);
      ctx.fillStyle = "#3D3A2A";
      ctx.font = '18px "DM Sans", system-ui, sans-serif';
      const title = courseTitle?.trim() || "the course";
      ctx.fillText(`has successfully completed`, canvas.width / 2, 480);
      ctx.font = '22px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(`"${title}"`, canvas.width / 2, 520);
      ctx.font = '14px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = "#5C5840";
      const date = certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleDateString() : "";
      if (date) ctx.fillText(`Issued: ${date}`, canvas.width / 2, 650);
      if (certificate.certificate_number) {
        ctx.fillText(`No. ${certificate.certificate_number}`, canvas.width / 2, 680);
      }
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Alchemy-Academy-Certificate-${user.name || "Alchemist"}.png`;
      link.click();
    } catch (error) {
      console.error("Failed to download certificate:", error);
    } finally {
      setIsDownloading(false);
    }
  };

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
            <div className="space-y-4">
              <div>
                <p className="text-sm text-foreground/65 mb-1">Certificate earned</p>
                <p className="text-lg font-serif text-foreground">
                  Congratulations on completing {courseTitle || "this course"}.
                </p>
              </div>
              <button
                onClick={handleDownloadCertificate}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
              >
                <Download size={16} />
                {isDownloading ? "Downloading..." : "Download Certificate"}
              </button>
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
