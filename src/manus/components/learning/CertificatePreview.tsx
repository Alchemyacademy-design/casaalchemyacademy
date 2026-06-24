import { Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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
 * Never inserts rows. Used in:
 *   - /admin/phase-2-preview (Section F)
 *   - AdminCourseDetail "Preview certificate" action
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
  const dateLabel = issuedAt
    ? new Date(issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

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
      <article
        aria-label="Certificate preview"
        className="relative overflow-hidden rounded-md border"
        style={{
          background: "var(--aa-cream)",
          borderColor: "var(--aa-cream-dark)",
          padding: "clamp(2rem, 4vw, 3.5rem)",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-3 rounded-sm pointer-events-none"
          style={{ border: "1px solid var(--aa-gold-light)" }}
        />
        <div className="relative flex flex-col items-center text-center gap-4">
          <Award className="w-8 h-8" style={{ color: "var(--aa-gold)" }} aria-hidden="true" />
          <p
            className="text-[11px] uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--aa-gold)", fontWeight: 600 }}
          >
            Certificate of Completion
          </p>
          <h2
            className="font-serif"
            style={{ color: "var(--aa-olive-dark)", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.05 }}
          >
            {studentName}
          </h2>
          <p style={{ color: "var(--aa-text-mid)", maxWidth: "32rem" }}>
            has successfully completed the course
          </p>
          <p
            className="font-serif italic"
            style={{ color: "var(--aa-olive-dark)", fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)" }}
          >
            {courseTitle}
          </p>
          <div
            className="mt-4 grid grid-cols-2 gap-6 text-[11px] uppercase w-full max-w-md"
            style={{ letterSpacing: "0.14em", color: "var(--aa-text-light)" }}
          >
            <div>
              <p>Issued</p>
              <p className="mt-1" style={{ color: "var(--aa-olive-dark)", letterSpacing: "0.05em", textTransform: "none" }}>
                {dateLabel}
              </p>
            </div>
            <div>
              <p>Certificate №</p>
              <p className="mt-1" style={{ color: "var(--aa-olive-dark)", letterSpacing: "0.05em", textTransform: "none" }}>
                {certificateNumber}
              </p>
            </div>
          </div>
        </div>
      </article>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={isPreview} aria-label="Download preview">
          <Download className="w-3 h-3 mr-1" />
          {isPreview ? "Download (preview)" : "Download"}
        </Button>
      </div>
    </div>
  );
}
