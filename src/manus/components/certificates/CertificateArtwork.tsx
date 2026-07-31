import { type CSSProperties } from "react";

export type CertificateArtworkProps = {
  studentName: string;
  courseTitle: string;
  issuedAt?: string | Date;
  certificateNumber: string;
  verifyUrl?: string;
};

/**
 * The single source of truth for the certificate's visual identity.
 * Rendered on the member page, admin preview, and public /c/:slug route.
 * The PDF (CertificatePdf.tsx) mirrors these tokens 1:1.
 *
 * Layout: A4 landscape (297 × 210 mm), asymmetric editorial composition.
 * Palette: cream / olive-dark / terracotta / gold — no gradients.
 */
export default function CertificateArtwork({
  studentName,
  courseTitle,
  issuedAt,
  certificateNumber,
  verifyUrl,
}: CertificateArtworkProps) {
  const dateLabel = issuedAt
    ? new Date(issuedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const wrap: CSSProperties = {
    position: "relative",
    aspectRatio: "297 / 210",
    width: "100%",
    background: "var(--aa-cream, #F5F0E8)",
    color: "var(--aa-olive-dark, #2E2A1E)",
    overflow: "hidden",
    fontFamily: "'Manrope', system-ui, sans-serif",
    borderRadius: 4,
  };

  const paperGrain: CSSProperties = {
    position: "absolute",
    inset: 0,
    opacity: 0.04,
    pointerEvents: "none",
    backgroundImage:
      "radial-gradient(circle at 20% 30%, #000 1px, transparent 1px), radial-gradient(circle at 70% 60%, #000 1px, transparent 1px)",
    backgroundSize: "3px 3px, 5px 5px",
  };

  const outerBorder: CSSProperties = {
    position: "absolute",
    inset: "3.2%",
    border: "1px solid var(--aa-gold, #B08A3E)",
    pointerEvents: "none",
  };
  const innerBorder: CSSProperties = {
    position: "absolute",
    inset: "3.9%",
    border: "1px solid var(--aa-gold-light, #D8B872)",
    pointerEvents: "none",
  };

  const leftRail: CSSProperties = {
    position: "absolute",
    left: "5.5%",
    top: "6%",
    bottom: "6%",
    width: "6%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const railText: CSSProperties = {
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    fontSize: 10,
    letterSpacing: "0.42em",
    textTransform: "uppercase",
    color: "var(--aa-olive, #6B5A2E)",
    fontWeight: 600,
  };

  const body: CSSProperties = {
    position: "absolute",
    left: "14%",
    right: "10%",
    top: "12%",
    bottom: "12%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const eyebrow: CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.32em",
    textTransform: "uppercase",
    color: "var(--aa-gold, #B08A3E)",
    fontWeight: 600,
  };

  const serifName: CSSProperties = {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
    lineHeight: 0.98,
    letterSpacing: "-0.01em",
    color: "var(--aa-olive-dark, #2E2A1E)",
    marginTop: "1.2rem",
  };

  const rule: CSSProperties = {
    width: "3.2rem",
    height: 2,
    background: "var(--aa-terracotta, #C46A3F)",
    marginTop: "1.4rem",
    marginBottom: "1.2rem",
  };

  const preamble: CSSProperties = {
    fontSize: "0.95rem",
    color: "var(--aa-text-mid, #6B6552)",
    maxWidth: "40rem",
  };

  const courseStyle: CSSProperties = {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontStyle: "italic",
    fontSize: "clamp(1.3rem, 2.8vw, 2rem)",
    color: "var(--aa-olive-dark, #2E2A1E)",
    marginTop: "0.5rem",
  };

  const meta: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "1.5rem",
    marginTop: "auto",
    paddingTop: "1.5rem",
    borderTop: "1px solid rgba(107,90,46,0.25)",
  };
  const metaLabel: CSSProperties = {
    fontSize: 9,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "var(--aa-text-light, #9C9782)",
    fontWeight: 600,
  };
  const metaValue: CSSProperties = {
    fontSize: "0.85rem",
    color: "var(--aa-olive-dark, #2E2A1E)",
    marginTop: "0.35rem",
    fontWeight: 500,
  };

  // Gold seal with the Alchemy Academy mark locked inside it (top-right medallion).
  const seal = (
    <div
      style={{ position: "absolute", right: "7.5%", top: "9%", width: "14%", aspectRatio: "1 / 1" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--aa-gold, #B08A3E)" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--aa-gold, #B08A3E)" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="34" fill="var(--aa-gold, #B08A3E)" opacity="0.06" />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const x1 = 50 + Math.cos(a) * 42;
          const y1 = 50 + Math.sin(a) * 42;
          const x2 = 50 + Math.cos(a) * 45;
          const y2 = 50 + Math.sin(a) * 45;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--aa-gold, #B08A3E)" strokeWidth="0.5" />
          );
        })}
      </svg>
      <img
        src="/img/logo.png"
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "62%",
          height: "62%",
          objectFit: "contain",
        }}
      />
    </div>
  );

  return (
    <div style={wrap} role="img" aria-label={`Certificate of completion for ${studentName}`}>
      <div style={paperGrain} aria-hidden="true" />
      <div style={outerBorder} aria-hidden="true" />
      <div style={innerBorder} aria-hidden="true" />
      {seal}
      <div style={leftRail} aria-hidden="true">
        <span style={railText}>
          Casa Alchemy Studio · Certificate № {certificateNumber}
        </span>
      </div>

      <div style={body}>
        <div>
          <div style={eyebrow}>Certificate of Completion</div>
          <div style={serifName}>{studentName}</div>
          <div style={rule} />
          <div style={preamble}>has completed, with dedication and craft, the course</div>
          <div style={courseStyle}>{courseTitle}</div>
        </div>

        <div style={meta}>
          <div>
            <div style={metaLabel}>Issued</div>
            <div style={metaValue}>{dateLabel}</div>
          </div>
          <div>
            <div style={metaLabel}>Certificate №</div>
            <div style={metaValue}>{certificateNumber}</div>
          </div>
          <div>
            <div style={metaLabel}>Verify at</div>
            <div style={{ ...metaValue, fontSize: "0.75rem", wordBreak: "break-all" }}>
              {verifyUrl ?? "casaalchemystudio.com"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
