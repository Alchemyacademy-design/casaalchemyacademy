import MemberLayout from "@/manus/components/MemberLayout";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { useMagazineIssues } from "@/manus/hooks/usePublicContent";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export default function Magazine() {
  const { data: issues = [], isLoading } = useMagazineIssues();
  const [current, ...archives] = issues;

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <Link to="/dashboard" className="flex items-center gap-2 mb-8 text-sm" style={{ color: "var(--aa-text-mid)" }}>
          <ArrowLeft size={16} /><span>Back to Dashboard</span>
        </Link>

        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>Magazine</h1>
          <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>Exclusive insights and inspiration for members.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
        ) : issues.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>No issues published yet.</p>
        ) : (
          <>
            <div className="mb-16">
              <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Current Issue</h2>
              <div className="p-8 rounded-lg" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex justify-center">
                    {current.cover_image_path ? (
                      <img src={current.cover_image_path} alt={current.title} style={{ width: "100%", maxWidth: 400, borderRadius: 8, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", maxWidth: 400, aspectRatio: "3/4", backgroundColor: "var(--aa-cacao)", borderRadius: 8 }} />
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    {current.published_on && (
                      <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{fmtDate(current.published_on)}</p>
                    )}
                    <h3 className="font-serif text-3xl mb-4" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>{current.title}</h3>
                    {current.description && (
                      <p className="text-sm mb-6" style={{ color: "var(--aa-text-mid)", lineHeight: 1.6 }}>{current.description}</p>
                    )}
                    <a href={current.external_file_url} target="_blank" rel="noreferrer" style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-cacao)", padding: "12px 24px", borderRadius: 4, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", textDecoration: "none" }}>
                      Read this issue <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {archives.length > 0 && (
              <div>
                <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Archives</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {archives.map((a) => (
                    <a key={a.id} href={a.external_file_url} target="_blank" rel="noreferrer" className="group cursor-pointer hover:shadow-lg transition" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)", borderRadius: 8, overflow: "hidden", textDecoration: "none" }}>
                      <div className="relative overflow-hidden" style={{ backgroundColor: "var(--aa-cacao)", height: 400, backgroundImage: a.cover_image_path ? `url('${a.cover_image_path}')` : "none", backgroundSize: "cover", backgroundPosition: "center" }}>
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition" />
                      </div>
                      <div className="p-6">
                        {a.published_on && <p className="text-xs mb-2" style={{ color: "var(--aa-gold)", letterSpacing: "0.1em" }}>{fmtDate(a.published_on)}</p>}
                        <h3 className="font-serif text-lg mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>{a.title}</h3>
                        <div className="flex items-center justify-end">
                          <ExternalLink size={16} style={{ color: "var(--aa-gold)" }} />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
        <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">← Back</a>
        <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">Exit</a>
      </div>
    </MemberLayout>
  );
}
