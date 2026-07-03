import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CertificateArtwork from "@/manus/components/certificates/CertificateArtwork";
import { downloadCertificatePdf } from "@/manus/components/certificates/downloadCertificatePdf";
import { Button } from "@/components/ui/button";
import { Award, Download, Linkedin, Link as LinkIcon, ShieldCheck } from "lucide-react";
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
    { status: "loading" } | { status: "ok"; cert: PublicCert } | { status: "notfound" }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_public_certificate", { slug });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) setState({ status: "notfound" });
      else setState({ status: "ok", cert: row as PublicCert });
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
            This link is invalid or the certificate has been revoked.
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

  return (
    <main className="min-h-screen py-10 px-4 md:px-10" style={{ background: "var(--aa-cream, #F5F0E8)" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--aa-gold, #B08A3E)" }} />
            <span
              className="text-[11px] uppercase font-semibold"
              style={{ letterSpacing: "0.22em", color: "var(--aa-olive, #6B5A2E)" }}
            >
              Verified · Casa Alchemy Studio
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(verifyUrl);
                toast.success("Link copied");
              }}
            >
              <LinkIcon className="w-3 h-3 mr-1" /> Copy link
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={shareLinkedIn} target="_blank" rel="noopener noreferrer">
                <Linkedin className="w-3 h-3 mr-1" /> Add to LinkedIn
              </a>
            </Button>
            <Button
              size="sm"
              onClick={() =>
                downloadCertificatePdf({
                  studentName: c.student_name,
                  courseTitle: c.course_title,
                  issuedAt: c.issued_at,
                  certificateNumber: c.certificate_number,
                  verifyUrl,
                })
              }
            >
              <Download className="w-3 h-3 mr-1" /> Download PDF
            </Button>
          </div>
        </header>

        <CertificateArtwork
          studentName={c.student_name}
          courseTitle={c.course_title}
          issuedAt={c.issued_at}
          certificateNumber={c.certificate_number}
          verifyUrl={verifyUrl}
        />

        <footer
          className="text-[11px] flex flex-wrap gap-4"
          style={{ color: "var(--aa-text-light, #9C9782)", letterSpacing: "0.06em" }}
        >
          <span>Verification hash · {c.verification_hash.slice(0, 16)}…</span>
          <span>Issued {new Date(c.issued_at).toLocaleDateString()}</span>
        </footer>
      </div>
    </main>
  );
}
