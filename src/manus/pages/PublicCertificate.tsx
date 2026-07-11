import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { downloadCertificatePdf } from "@/manus/components/certificates/downloadCertificatePdf";
import { Button } from "@/components/ui/button";
import { Award, Download, Linkedin, Link as LinkIcon, ShieldCheck, Sparkles, GraduationCap } from "lucide-react";
import { toast } from "sonner";

type PublicCert = {
  public_slug: string;
  certificate_number: string;
  issued_at: string;
  student_name: string;
  course_title: string;
  verification_hash: string;
};

export default function PublicCertificate() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ok"; cert: PublicCert }
    | { status: "revoked"; certificate_number: string; revoked_at: string }
    | { status: "notfound" }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_public_certificate_status", { slug });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setState({ status: "notfound" });
      } else if (row.status === "revoked") {
        setState({
          status: "revoked",
          certificate_number: row.certificate_number,
          revoked_at: row.revoked_at,
        });
      } else {
        setState({ status: "ok", cert: row as PublicCert });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const verifyUrl = typeof window !== "undefined" ? window.location.href : `casaalchemystudio.com/c/${slug}`;

  useEffect(() => {
    if (state.status !== "ok") return;
    const c = state.cert;
    document.title = `${c.student_name} — ${c.course_title} · Casa Alchemy Studio`;
    const desc = `Verified certificate of completion issued to ${c.student_name} for ${c.course_title}. Certificate № ${c.certificate_number}.`;
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setMeta("description", desc);
    setMeta("og:title", `${c.student_name} — ${c.course_title}`, "property");
    setMeta("og:description", desc, "property");
    setMeta("og:type", "article", "property");
    setMeta("twitter:card", "summary_large_image");

    let ld = document.getElementById("cert-jsonld") as HTMLScriptElement | null;
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.id = "cert-jsonld";
      document.head.appendChild(ld);
    }
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "EducationalOccupationalCredential",
      name: c.course_title,
      credentialCategory: "certificate",
      recognizedBy: { "@type": "Organization", name: "Casa Alchemy Studio" },
      identifier: c.certificate_number,
      dateCreated: c.issued_at,
      url: verifyUrl,
      about: c.course_title,
      recipient: { "@type": "Person", name: c.student_name },
    });
  }, [state, verifyUrl]);

  if (state.status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--aa-cream, #F5F0E8)" }}>
        <p className="text-sm" style={{ color: "var(--aa-text-mid, #6B6552)" }}>Verifying certificate…</p>
      </main>
    );
  }
  if (state.status === "notfound") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--aa-cream, #F5F0E8)" }}>
        <div className="text-center max-w-md">
          <Award className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--aa-gold, #B08A3E)" }} />
          <h1 className="font-serif text-2xl mb-2" style={{ color: "var(--aa-olive-dark, #2E2A1E)" }}>
            Certificate not found
          </h1>
          <p className="text-sm" style={{ color: "var(--aa-text-mid, #6B6552)" }}>
            This link is invalid, private, or has never existed.
          </p>
        </div>
      </main>
    );
  }

  if (state.status === "revoked") {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--aa-cream, #F5F0E8)" }}
      >
        <div className="text-center max-w-md">
          <ShieldCheck
            className="w-8 h-8 mx-auto mb-3"
            style={{ color: "var(--aa-terracotta, #C46A3F)" }}
          />
          <div
            className="text-[10px] font-semibold mb-2"
            style={{
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--aa-terracotta, #C46A3F)",
            }}
          >
            Certificate Revoked
          </div>
          <h1
            className="mb-3"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(1.6rem, 3vw, 2.25rem)",
              color: "var(--aa-olive-dark, #2E2A1E)",
            }}
          >
            This credential is no longer valid.
          </h1>
          <p className="text-sm mb-1" style={{ color: "var(--aa-text-mid, #6B6552)" }}>
            Casa Alchemy Academy revoked certificate № {state.certificate_number} on{" "}
            {new Date(state.revoked_at).toLocaleDateString()}.
          </p>
          <p className="text-xs" style={{ color: "var(--aa-text-light, #9C9782)" }}>
            If you believe this is an error, please contact the studio.
          </p>
        </div>
      </main>
    );
  }

  const c = state.cert;
  const shareLinkedIn = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
    c.course_title,
  )}&organizationName=${encodeURIComponent("Casa Alchemy Studio")}&issueYear=${new Date(c.issued_at).getFullYear()}&issueMonth=${
    new Date(c.issued_at).getMonth() + 1
  }&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(c.certificate_number)}`;

  const issuedLabel = new Date(c.issued_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const copyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    toast.success("Link copied");
  };
  const doDownload = () =>
    downloadCertificatePdf({
      studentName: c.student_name,
      courseTitle: c.course_title,
      issuedAt: c.issued_at,
      certificateNumber: c.certificate_number,
      verifyUrl,
    });

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--aa-cream, #F5F0E8)",
        color: "var(--aa-olive-dark, #2E2A1E)",
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      {/* Sticky top bar */}
      <div
        className="sticky top-0 z-30 backdrop-blur border-b"
        style={{
          background: "rgba(245,240,232,0.85)",
          borderColor: "rgba(107,90,46,0.18)",
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 md:px-10 py-3 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "var(--aa-gold, #B08A3E)" }} />
            <span
              className="text-[10px] md:text-[11px] uppercase font-semibold truncate"
              style={{ letterSpacing: "0.22em", color: "var(--aa-olive, #6B5A2E)" }}
            >
              Verified · Casa Alchemy Academy
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="hidden sm:inline-flex">
              <LinkIcon className="w-3 h-3 mr-1" /> Copy link
            </Button>
            <Button size="sm" onClick={doDownload}>
              <Download className="w-3 h-3 mr-1" /> Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* HERO */}
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
            {c.student_name}
          </h1>
          <div
            className="h-[2px] w-16 mb-6"
            style={{ background: "var(--aa-terracotta, #C46A3F)" }}
          />
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
            {c.course_title}
          </p>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl">
            {[
              { label: "Issued", value: issuedLabel },
              { label: "Certificate №", value: c.certificate_number },
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

      {/* ABOUT / STUDIO */}
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
                Completed 100% of published lessons in <em>{c.course_title}</em>.
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

      {/* VERIFY */}
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
              {c.certificate_number}
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
              {c.verification_hash}
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
              {verifyUrl}
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
          <Button variant="outline" onClick={copyLink}>
            <LinkIcon className="w-3 h-3 mr-1" /> Copy public link
          </Button>
          <Button variant="outline" asChild>
            <a href={shareLinkedIn} target="_blank" rel="noopener noreferrer">
              <Linkedin className="w-3 h-3 mr-1" /> Add to LinkedIn
            </a>
          </Button>
        </div>
      </section>

      {/* FOOTER */}
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
    </main>
  );
}
