import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import CertificateArtwork from "@/manus/components/certificates/CertificateArtwork";
import { downloadCertificatePdf } from "@/manus/components/certificates/downloadCertificatePdf";

export type CertificatePreviewProps = {
  studentName?: string;
  courseTitle?: string;
  certificateNumber?: string;
  issuedAt?: string;
  /** When true, renders the "Admin Preview" badge and disables download semantics. */
  isPreview?: boolean;
};

/**
 * Visual-only certificate preview.
 *
 * Never inserts rows. Used in admin contexts (e.g. AdminCourseDetail
 * "Preview certificate") and as the empty-state visual on real student
 * pages until a real certificate is issued.
 *
 * Identity stays inside the project tokens (Instrument Serif / Manrope,
 * Chocolate / Terracotta / Sandstone) — no Cormorant / DM Sans from the PDF.
 */
export default function CertificatePreview({
  studentName = "Preview Student",
  courseTitle = "The path to a COLOURFUL life",
  certificateNumber = "AA-PREVIEW-0001",
  issuedAt,
  isPreview = true,
}: CertificatePreviewProps) {
  return (
    <div className="space-y-3">
      {isPreview && (
        <span
          className="inline-block text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm"
          style={{ background: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
        >
          Admin Preview
        </span>
      )}
      <CertificateArtwork
        studentName={studentName}
        courseTitle={courseTitle}
        issuedAt={issuedAt}
        certificateNumber={certificateNumber}
      />
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCertificatePdf({ studentName, courseTitle, issuedAt, certificateNumber })
          }
          aria-label="Download preview PDF"
        >
          <Download className="w-3 h-3 mr-1" />
          Download preview PDF
        </Button>
      </div>
    </div>
  );
}
