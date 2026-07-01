import { useState } from "react";
import MemberLayout from "@/manus/components/MemberLayout";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Loader2, PlayCircle } from "lucide-react";
import { useMagazineIssues } from "@/manus/hooks/usePublicContent";

const WINTER_VIDEO_URL = "/manus-storage/Winter26(1)_a8a1dfca.mp4";
const VIDEO_MARKER_RE = /\s*\[\[video:([^\]]*)\]\]\s*/g;

function extractVideoUrl(description?: string | null): string | null {
  if (!description) return null;
  const m = /\[\[video:([^\]]*)\]\]/.exec(description);
  return m?.[1]?.trim() || null;
}
function cleanDescription(description?: string | null): string {
  if (!description) return "";
  return description.replace(VIDEO_MARKER_RE, "").trim();
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export default function Magazine() {
  const { data: issues = [], isLoading, isError, refetch } = useMagazineIssues();
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [current, ...archives] = issues;
  const currentVideo = extractVideoUrl(current?.description) ?? WINTER_VIDEO_URL;
  const currentDescription = cleanDescription(current?.description);


  return (
    <MemberLayout>
      <main className="min-h-screen bg-[var(--aa-cream)] px-5 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-6xl">
          <Link to="/dashboard" className="mb-10 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--aa-text-mid)]">
            <ArrowLeft size={15} /><span>Back to Dashboard</span>
          </Link>

          <header className="mb-12 border-b border-[var(--aa-cream-dark)] pb-8">
            <p className="section-label mb-3">The Alchemy Edit</p>
            <h1 className="font-serif text-5xl font-normal text-[var(--aa-olive-dark)] md:text-7xl">Magazine</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--aa-text-mid)]">
              Seasonal interior-design knowledge, thoughtful inspiration and practical guidance for members.
            </p>
          </header>

          {!videoUnavailable && (
            <section className="mb-16 overflow-hidden border border-[var(--aa-cream-dark)] bg-[#1F0A03]">
              <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_.55fr]">
                <video
                  className="aspect-video h-full w-full bg-black object-cover"
                  src={currentVideo}
                  key={currentVideo}
                  controls
                  playsInline
                  preload="metadata"
                  poster={current?.cover_image_path ?? undefined}
                  onError={() => setVideoUnavailable(true)}
                />
                <div className="flex flex-col justify-center p-7 text-[var(--aa-cream)] md:p-10">
                  <PlayCircle size={24} className="mb-5 text-[var(--aa-gold)]" />
                  <p className="section-label mb-3">Featured presentation</p>
                  <h2 className="font-serif text-4xl font-normal">Winter 2026</h2>
                  <p className="mt-4 text-sm leading-7 text-white/70">
                    Watch the editorial presentation, then explore the current edition and the complete archive below.
                  </p>
                </div>
              </div>
            </section>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-[var(--aa-text-mid)]"><Loader2 className="animate-spin" size={16} /> Loading…</div>
          ) : isError ? (
            <div className="border border-[var(--aa-cream-dark)] bg-white p-8 text-center">
              <p className="text-sm text-[var(--aa-text-mid)]">The magazine could not be loaded.</p>
              <button type="button" onClick={() => refetch()} className="btn-gold mt-5 px-6 py-3">Retry</button>
            </div>
          ) : issues.length === 0 ? (
            <div className="border border-dashed border-[var(--aa-cream-dark)] p-10 text-center text-sm text-[var(--aa-text-mid)]">
              No issues published yet.
            </div>
          ) : (
            <>
              <section className="mb-16">
                <div className="mb-6 flex items-end justify-between border-b border-[var(--aa-cream-dark)] pb-4">
                  <div><p className="section-label mb-2">Latest edition</p><h2 className="font-serif text-4xl font-normal text-[var(--aa-olive-dark)]">Current Issue</h2></div>
                  {current.published_on && <p className="text-xs uppercase tracking-[0.14em] text-[var(--aa-text-light)]">{fmtDate(current.published_on)}</p>}
                </div>

                <article className="grid grid-cols-1 gap-0 border border-[var(--aa-cream-dark)] bg-white md:grid-cols-[.82fr_1.18fr]">
                  <div className="flex min-h-[420px] items-center justify-center bg-[var(--aa-cream-dark)]/35 p-6">
                    {current.cover_image_path ? (
                      <img src={current.cover_image_path} alt={current.title} loading="lazy" className="max-h-[620px] w-full max-w-md object-contain" />
                    ) : (
                      <div className="aspect-[3/4] w-full max-w-sm bg-[var(--aa-olive-dark)]" />
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-8 md:p-12">
                    <p className="section-label mb-3">Member edition</p>
                    <h3 className="font-serif text-4xl font-normal text-[var(--aa-olive-dark)] md:text-5xl">{current.title}</h3>
                    {current.description && <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--aa-text-mid)]">{current.description}</p>}
                    <div className="mt-8 flex flex-wrap gap-3">
                      <a href={current.external_file_url} target="_blank" rel="noreferrer" className="btn-gold inline-flex items-center gap-2 px-6 py-3">
                        Read this issue <ExternalLink size={14} />
                      </a>
                      <a href={current.external_file_url} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-2 border border-[var(--aa-olive-dark)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aa-olive-dark)]">
                        Download <Download size={14} />
                      </a>
                    </div>
                  </div>
                </article>
              </section>

              <section>
                <div className="mb-6 border-b border-[var(--aa-cream-dark)] pb-4"><p className="section-label mb-2">Library</p><h2 className="font-serif text-4xl font-normal text-[var(--aa-olive-dark)]">Archive</h2></div>
                {archives.length === 0 ? (
                  <p className="border border-dashed border-[var(--aa-cream-dark)] p-8 text-sm text-[var(--aa-text-mid)]">Previous editions will appear here as they are published.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {archives.map((issue) => (
                      <a key={issue.id} href={issue.external_file_url} target="_blank" rel="noreferrer" className="group border border-[var(--aa-cream-dark)] bg-white">
                        <div className="relative h-[390px] overflow-hidden bg-[var(--aa-olive-dark)]" style={{ backgroundImage: issue.cover_image_path ? `url('${issue.cover_image_path}')` : "none", backgroundSize: "cover", backgroundPosition: "center" }}>
                          <div className="absolute inset-0 bg-black/15 transition group-hover:bg-black/30" />
                        </div>
                        <div className="p-6">
                          {issue.published_on && <p className="section-label mb-2">{fmtDate(issue.published_on)}</p>}
                          <h3 className="font-serif text-2xl font-normal text-[var(--aa-olive-dark)]">{issue.title}</h3>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </MemberLayout>
  );
}
