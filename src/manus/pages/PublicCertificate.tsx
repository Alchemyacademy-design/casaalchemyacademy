import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Award, ShieldCheck } from "lucide-react";
import CertificatePortfolioLayout from "@/manus/components/certificates/CertificatePortfolioLayout";

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
        // Fire-and-forget view tracking; never blocks render, never surfaces errors.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).rpc("record_certificate_view", {
            slug,
            p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            p_referrer: typeof document !== "undefined" ? document.referrer || null : null,
          });
        } catch { /* noop */ }
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
  return (
    <main className="min-h-screen">
      <CertificatePortfolioLayout
        studentName={c.student_name}
        courseTitle={c.course_title}
        issuedAt={c.issued_at}
        certificateNumber={c.certificate_number}
        verificationHash={c.verification_hash}
        verifyUrl={verifyUrl}
      />
    </main>
  );
}
