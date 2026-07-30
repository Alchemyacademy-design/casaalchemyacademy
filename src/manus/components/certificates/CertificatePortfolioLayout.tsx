import { Download, Linkedin, Link as LinkIcon, ShieldCheck, Sparkles, GraduationCap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCertificatePdf } from "@/manus/components/certificates/downloadCertificatePdf";
import { toast } from "sonner";

export type CertificatePortfolioProps = {
  studentName: string;
  courseTitle: string;
  issuedAt: string | Date;
  certificateNumber: string;
  verificationHash?: string | null;
  verifyUrl?: string | null;
  /** Renders a bold banner making clear the render is a test, not a saved certificate. */
  previewBanner?: boolean;
  /** When false, drops the sticky top bar (useful when embedded inside an admin shell). */
  showTopBar?: boolean;
  /** When false, hides LinkedIn share (useful for previews without a real slug). */
  showLinkedIn?: boolean;
};

/**
 * Shared "digital portfolio" layout used by both the public /c/:slug page and
 * the admin certificate preview / issuance flows. Never fetches data — the
 * caller passes everything in. Copies verbatim the tokens used by
 * CertificateArtwork so the identity stays consistent.
 */
export default function CertificatePortfolioLayout({
  studentName,
  courseTitle,
  issuedAt,
  certificateNumber,
  verificationHash,
  verifyUrl,
  previewBanner = false,
  showTopBar = true,
  showLinkedIn = true,
}: CertificatePortfolioProps) {
  const issuedDate = typeof issuedAt === "string" ? new Date(issuedAt) : issuedAt;
  const issuedIso = issuedDate.toISOString();
  const issuedLabel = issuedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const copyLink = () => {
    if (!verifyUrl) return;
    navigator.clipboard.writeText(verifyUrl);
    toast.success("Link copied");
  };
  const doDownload = () =>
    downloadCertificatePdf({
      studentName,
      courseTitle,
      issuedAt: issuedIso,
      certificateNumber,
      verifyUrl: verifyUrl ?? undefined,
    });

  const shareLinkedIn =
    showLinkedIn && verifyUrl
      ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
          courseTitle,
        )}&organizationName=${encodeURIComponent("Casa Alchemy Studio")}&issueYear=${issuedDate.getFullYear()}&issueMonth=${
          issuedDate.getMonth() + 1
        }&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(certificateNumber)}`
      : null;

  return (
    <div
      className="min-h-full"
      style={{
        background: "var(--aa-cream, #F5F0E8)",
        color: "var(--aa-olive-dark, #2E2A1E)",
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      {previewBanner && (
        <div
          className="flex items-center justify-center gap-2 text-[11px] md:text-xs font-semibold py-2 px-4 text-center"
          style={{
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            background: "var(--aa-terracotta, #C46A3F)",
            color: "var(--aa-cream, #F5F0E8)",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Preview — not saved, no real certificate created
        </div>
      )}

      {showTopBar && (
        <div
          className="sticky top-0 z-30 backdrop-blur border-b"
          style={{
            background: "rgba(245,240,232,0.85)",
            borderColor: "rgba(107,90,46,0.18)",
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between px-5 md:px-10 py-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/img/logo.png"
                alt="Casa Alchemy Academy"
                className="h-6 md:h-7 w-auto shrink-0"
              />
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "var(--aa-gold, #B08A3E)" }} />
              <span
                className="text-[10px] md:text-[11px] uppercase font-semibold truncate"
                style={{ letterSpacing: "0.22em", color: "var(--aa-olive, #6B5A2E)" }}
              >
                Verified · Casa Alchemy Academy
              </span>
            </div>
            <div className="flex items-center gap-2">
              {verifyUrl && (
                <Button variant="outline" size="sm" onClick={copyLink} className="hidden sm:inline-flex">
                  <LinkIcon className="w-3 h-3 mr-1" /> Copy link
                </Button>
              )}
              <Button size="sm" onClick={doDownload}>
                <Download className="w-3 h-3 mr-1" /> Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(196,106,63,0.10), transparent 55%), radial-gradient(circle at 85% 80%, rgba(176,138,62,0.12), transparent 55%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 md:px-10 pt-14 md:pt-24 pb-16 md:pb-24">
          <img
            src="/img/logo.png"
            alt="Casa Alchemy Academy"
            className="h-12 md:h-16 w-auto mb-8"
          />
          <div
            className="text-[10px] md:text-[11px] font-semibold inline-flex items-center gap-2 mb-6"
            style={{ letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--aa-gold, #B08A3E)" }}
          >
            <Sparkles className="w-3 h-3" /> Certificate of Completion
          </div>
          <h1
            className="leading-[0.95] tracking-[-0.02em] mb-6"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(2.75rem, 9vw, 6.5rem)",
              color: "var(--aa-olive-dark, #2E2A1E)",
            }}
          >
            {studentName}
          </h1>
          <div className="h-[2px] w-16 mb-6" style={{ background: "var(--aa-terracotta, #C46A3F)" }} />
          <p className="text-base md:text-lg max-w-2xl" style={{ color: "var(--aa-text-mid, #6B6552)" }}>
            has completed, with dedication and craft, the course
          </p>
          <p
            className="mt-3 italic"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(1.5rem, 3.6vw, 2.5rem)",
              lineHeight: 1.15,
              color: "var(--aa-olive-dark, #2E2A1E)",
            }}
          >
            {courseTitle}
          </p>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl">
            {[
              { label: "Issued", value: issuedLabel },
              { label: "Certificate №", value: certificateNumber },
              { label: "Awarded by", value: "Casa Alchemy Academy" },
            ].map((m) => (
              <div key={m.label}>
                <div
                  className="text-[9px] md:text-[10px] font-semibold mb-1"
                  style={{
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--aa-text-light, #9C9782)",
                  }}
                >
                  {m.label}
                </div>
                <div className="text-sm md:text-base font-medium" style={{ color: "var(--aa-olive-dark, #2E2A1E)" }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="border-y"
        style={{ borderColor: "rgba(107,90,46,0.18)", background: "rgba(255,255,255,0.35)" }}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-14 md:py-20 grid md:grid-cols-[1.1fr_1fr] gap-10 md:gap-16 items-start">
          <div>
            <div
              className="text-[10px] font-semibold mb-4"
              style={{ letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--aa-terracotta, #C46A3F)" }}
            >
              Issued by
            </div>
            <h2
              className="mb-4"
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
                lineHeight: 1.1,
                color: "var(--aa-olive-dark, #2E2A1E)",
              }}
            >
              Casa Alchemy Academy
            </h2>
            <p className="text-sm md:text-base leading-relaxed max-w-xl" style={{ color: "var(--aa-text-mid, #6B6552)" }}>
              A studio-led program by <strong>Lorena Couto</strong> teaching the craft of designing
              soulful, colourful interiors. Certificates are issued after completing every published
              lesson and passing all required assessments.
            </p>
            <a
              href="https://casaalchemystudio.com/alchemy-academy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-6 text-sm font-medium underline underline-offset-4"
              style={{ color: "var(--aa-terracotta, #C46A3F)" }}
            >
              Explore the Academy →
            </a>
          </div>

          <div
            className="rounded-sm p-6 md:p-8"
            style={{
              background: "var(--aa-cream, #F5F0E8)",
              border: "1px solid rgba(176,138,62,0.35)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-4 h-4" style={{ color: "var(--aa-gold, #B08A3E)" }} />
              <span
                className="text-[10px] font-semibold"
                style={{ letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--aa-olive, #6B5A2E)" }}
              >
                What this credential means
              </span>
            </div>
            <ul className="space-y-3 text-sm" style={{ color: "var(--aa-olive-dark, #2E2A1E)" }}>
              <li className="flex gap-3">
                <span style={{ color: "var(--aa-terracotta, #C46A3F)" }}>◆</span>
                Completed 100% of published lessons in <em>{courseTitle}</em>.
              </li>
              <li className="flex gap-3">
                <span style={{ color: "var(--aa-terracotta, #C46A3F)" }}>◆</span>
                Passed every required assessment linked to the course.
              </li>
              <li className="flex gap-3">
                <span style={{ color: "var(--aa-terracotta, #C46A3F)" }}>◆</span>
                Verified and cryptographically hashed by Casa Alchemy Academy.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-10 py-14 md:py-20">
        <div
          className="text-[10px] font-semibold mb-4"
          style={{ letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--aa-gold, #B08A3E)" }}
        >
          Verification
        </div>
        <h2
          className="mb-8"
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(1.6rem, 3vw, 2.25rem)",
            color: "var(--aa-olive-dark, #2E2A1E)",
          }}
        >
          This credential is authentic.
        </h2>
        <dl className="grid sm:grid-cols-2 gap-6 md:gap-10 max-w-4xl">
          <div>
            <dt
              className="text-[10px] font-semibold mb-1"
              style={{ letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--aa-text-light, #9C9782)" }}
            >
              Certificate Number
            </dt>
            <dd className="font-mono text-sm" style={{ color: "var(--aa-olive-dark, #2E2A1E)" }}>
              {certificateNumber}
            </dd>
          </div>
          <div>
            <dt
              className="text-[10px] font-semibold mb-1"
              style={{ letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--aa-text-light, #9C9782)" }}
            >
              Verification Hash
            </dt>
            <dd className="font-mono text-xs break-all" style={{ color: "var(--aa-olive-dark, #2E2A1E)" }}>
              {verificationHash ?? "— not available in preview —"}
            </dd>
          </div>
          <div>
            <dt
              className="text-[10px] font-semibold mb-1"
              style={{ letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--aa-text-light, #9C9782)" }}
            >
              Public URL
            </dt>
            <dd className="text-sm break-all" style={{ color: "var(--aa-olive-dark, #2E2A1E)" }}>
              {verifyUrl ?? "— private / preview only —"}
            </dd>
          </div>
          <div>
            <dt
              className="text-[10px] font-semibold mb-1"
              style={{ letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--aa-text-light, #9C9782)" }}
            >
              Issued On
            </dt>
            <dd className="text-sm" style={{ color: "var(--aa-olive-dark, #2E2A1E)" }}>
              {issuedLabel}
            </dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-wrap gap-2">
          <Button onClick={doDownload}>
            <Download className="w-3 h-3 mr-1" /> Download as PDF
          </Button>
          {verifyUrl && (
            <Button variant="outline" onClick={copyLink}>
              <LinkIcon className="w-3 h-3 mr-1" /> Copy public link
            </Button>
          )}
          {shareLinkedIn && (
            <Button variant="outline" asChild>
              <a href={shareLinkedIn} target="_blank" rel="noopener noreferrer">
                <Linkedin className="w-3 h-3 mr-1" /> Add to LinkedIn
              </a>
            </Button>
          )}
        </div>
      </section>

      <footer
        className="border-t"
        style={{
          borderColor: "rgba(107,90,46,0.18)",
          background: "var(--aa-olive-dark, #2E2A1E)",
          color: "var(--aa-cream, #F5F0E8)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-14 grid md:grid-cols-[1.4fr_1fr] gap-8 items-end">
          <div>
            <div
              className="text-[10px] font-semibold mb-3"
              style={{ letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--aa-gold-light, #D8B872)" }}
            >
              Casa Alchemy Academy
            </div>
            <p
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                lineHeight: 1.15,
              }}
            >
              A colourful life, learned in craft.
            </p>
          </div>
          <div className="text-xs md:text-sm space-y-2" style={{ color: "rgba(245,240,232,0.75)" }}>
            <a
              href="https://casaalchemystudio.com/alchemy-academy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 block"
            >
              casaalchemystudio.com/alchemy-academy
            </a>
            <div>© {new Date().getFullYear()} Casa Alchemy Studio · Lorena Couto</div>
          </div>
        </div>
      </footer>
    </div>
  );
}