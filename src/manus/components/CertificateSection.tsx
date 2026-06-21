import { useState } from "react";
import { Download, Award } from "lucide-react";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";

export function CertificateSection() {
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);

  const completionQuery = trpc.certificates.completionPercentage.useQuery();
  const eligibilityQuery = trpc.certificates.isEligible.useQuery();
  const certificateQuery = trpc.certificates.myCertificate.useQuery();
  const issueMutation = trpc.certificates.issueCertificate.useMutation();

  const completion = completionQuery.data ?? 0;
  const isEligible = eligibilityQuery.data ?? false;
  const certificate = certificateQuery.data;

  const handleIssueCertificate = async () => {
    try {
      await issueMutation.mutateAsync();
      certificateQuery.refetch();
    } catch (error) {
      console.error("Failed to issue certificate:", error);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!certificate || !user) return;

    setIsDownloading(true);
    try {
      // Create a simple PNG certificate
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      // Background
      ctx.fillStyle = "#F5F2ED";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Border
      ctx.strokeStyle = "#914621";
      ctx.lineWidth = 8;
      ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

      // Title
      ctx.font = "bold 60px 'Georgia', serif";
      ctx.fillStyle = "#1F0A03";
      ctx.textAlign = "center";
      ctx.fillText("Certificate of Completion", canvas.width / 2, 150);

      // Subtitle
      ctx.font = "24px 'Arial', sans-serif";
      ctx.fillStyle = "#7A6E36";
      ctx.fillText("Alchemy Academy", canvas.width / 2, 220);

      // Body text
      ctx.font = "18px 'Arial', sans-serif";
      ctx.fillStyle = "#1F0A03";
      ctx.textAlign = "center";
      ctx.fillText("This certifies that", canvas.width / 2, 320);

      // User name
      ctx.font = "bold 36px 'Georgia', serif";
      ctx.fillStyle = "#914621";
      ctx.fillText(user.name || "Alchemist", canvas.width / 2, 400);

      // Achievement text
      ctx.font = "18px 'Arial', sans-serif";
      ctx.fillStyle = "#1F0A03";
      ctx.fillText("has successfully completed the Interior Design Education course", canvas.width / 2, 480);
      ctx.fillText(`with ${certificate.completionPercentage}% completion`, canvas.width / 2, 530);

      // Date
      const date = new Date(certificate.issuedAt).toLocaleDateString();
      ctx.font = "14px 'Arial', sans-serif";
      ctx.fillStyle = "#7A6E36";
      ctx.fillText(`Issued: ${date}`, canvas.width / 2, 650);

      // Download
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
        <Award size={24} style={{ color: "var(--ca-terracotta)" }} />
        <h2 className="text-2xl font-serif" style={{ color: "var(--ca-cacao)" }}>
          Your Certificate
        </h2>
      </div>

      {/* Progress Section */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: "var(--ca-sandstone)" }}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: "var(--ca-cacao)" }}>Course Completion</span>
              <span className="font-semibold" style={{ color: "var(--ca-terracotta)" }}>
                {completion}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full" style={{ backgroundColor: "var(--ca-moss)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${completion}%`,
                  backgroundColor: "var(--ca-terracotta)",
                }}
              />
            </div>
          </div>

          {isEligible && (
            <p className="text-sm" style={{ color: "var(--ca-cacao)", opacity: 0.7 }}>
              🎉 You're eligible to earn your certificate!
            </p>
          )}
        </div>
      </div>

      {/* Certificate Section */}
      {isEligible && (
        <div className="p-6 rounded-lg" style={{ backgroundColor: "var(--ca-moss)" }}>
          {certificate ? (
            <div className="space-y-4">
              <div>
                <p style={{ color: "var(--ca-cacao)" }} className="text-sm mb-2">
                  ✓ Certificate Earned
                </p>
                <p className="text-lg font-serif" style={{ color: "var(--ca-cacao)" }}>
                  Congratulations on completing the Alchemy Academy course!
                </p>
              </div>
              <button
                onClick={handleDownloadCertificate}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: "var(--ca-terracotta)",
                  color: "white",
                  opacity: isDownloading ? 0.7 : 1,
                }}
              >
                <Download size={16} />
                {isDownloading ? "Downloading..." : "Download Certificate"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleIssueCertificate}
              disabled={issueMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "var(--ca-terracotta)",
                color: "white",
                opacity: issueMutation.isPending ? 0.7 : 1,
              }}
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
