import { useEffect, useState } from "react";
import MemberLayout from "@/manus/components/MemberLayout";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Download, ExternalLink, Eye, Loader2, PlayCircle, X } from "lucide-react";
import { useMagazineIssues } from "@/manus/hooks/usePublicContent";
import { normalizeVideoUrl } from "@/manus/lib/video-url";

const WINTER_VIDEO_URL = "/manus-storage/Winter26(1)_a8a1dfca.mp4";
const VIDEO_MARKER_RE = /\s*\[\[video:([^\]]*)\]\]\s*/g;

/**
 * Native PDF preview via blob URL. Dropbox and some CDNs send
 * Content-Disposition: attachment, which forces a download inside <iframe>.
 * Fetching the bytes and turning them into a blob URL lets the browser use
 * its built-in PDF viewer inline. If the fetch fails (CORS / network), the
 * caller falls back to a download-only UX.
 */
function useInlinePdf(url: string | null | undefined) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; blobUrl: string | null }>({
    status: "idle",
    blobUrl: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ status: "idle", blobUrl: null });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: "loading", blobUrl: null });
    fetch(url, { mode: "cors", credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(pdfBlob);
        setState({ status: "ready", blobUrl: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", blobUrl: null });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return state;
}

function NativePdfViewer({ url, title, className }: { url: string; title: string; className?: string }) {
  const { status, blobUrl } = useInlinePdf(url);
  if (status === "loading" || status === "idle") {
    return (
      <div className={`flex items-center justify-center bg-white text-sm text-[var(--aa-text-mid)] ${className ?? ""}`}>
        <Loader2 className="mr-2 animate-spin" size={16} /> Loading PDF…
      </div>
    );
  }
  if (status === "error" || !blobUrl) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 bg-white p-6 text-center ${className ?? ""}`}>
        <p className="text-sm text-[var(--aa-text-mid)]">Inline preview unavailable for this file. Please download to view.</p>
        <a href={url} target="_blank" rel="noreferrer" download className="btn-gold inline-flex items-center gap-2 px-5 py-3 text-xs">
          <Download size={13} /> Download PDF
        </a>
      </div>
    );
  }
  return (
    <object data={blobUrl} type="application/pdf" title={title} className={`bg-white ${className ?? ""}`}>
      <iframe src={blobUrl} title={title} className={`w-full bg-white ${className ?? ""}`} />
    </object>
  );
}

function extractVideoUrl(description?: string | null): string | null {
  if (!description) return null;
  const m = /\[\[video:([^\]]*)\]\]/.exec(description);
  return m?.[1]?.trim() || null;
}
function cleanDescription(description?: string | null): string {
  if (!description) return "";
  return description.replace(VIDEO_MARKER_RE, "").trim();
}

/**
 * Dropbox share URLs (dropbox.com/…?dl=0) render an HTML preview, not the
 * file bytes. Rewrite to dl.dropboxusercontent.com + raw=1 so <iframe>,
 * <video>, and <img> stream the asset directly. Non-Dropbox URLs pass
 * through untouched.
 */
function normalizeDoc(url: string | null | undefined): string {
  return url ? normalizeVideoUrl(url) || url : "";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

/**
 * Dropbox serves PDFs with Content-Disposition: attachment, so pointing an
 * <iframe> at the raw URL triggers a download instead of rendering. Wrap the
 * public URL in Google's viewer (docs.google.com/gview) so it renders inline
 * for any public PDF. Falls back to the raw URL if not a PDF-like link.
 */
function toInlineReaderUrl(url: string): string {
  if (!url) return "";
  return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
}

export default function Magazine() {
  const { data: issues = [], isLoading, isError, refetch } = useMagazineIssues();
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [previewIssue, setPreviewIssue] = useState<{ title: string; url: string } | null>(null);
  const [current, ...archives] = issues;
  const currentVideo = normalizeDoc(extractVideoUrl(current?.description)) || WINTER_VIDEO_URL;
  const currentDescription = cleanDescription(current?.description);
  const currentPdf = normalizeDoc(current?.external_file_url);
  const currentCover = normalizeDoc(current?.cover_image_path);



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
                    {currentCover ? (
                      <img src={currentCover} alt={current.title} loading="lazy" className="max-h-[620px] w-full max-w-md object-contain" />
                    ) : (
                      <div className="aspect-[3/4] w-full max-w-sm bg-[var(--aa-olive-dark)]" />
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-8 md:p-12">
                    <p className="section-label mb-3">Member edition</p>
                    <h3 className="font-serif text-4xl font-normal text-[var(--aa-olive-dark)] md:text-5xl">{current.title}</h3>
                    {currentDescription && <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--aa-text-mid)]">{currentDescription}</p>}
                    <div className="mt-8 flex flex-wrap gap-3">
                      {currentPdf && (
                        <button
                          type="button"
                          onClick={() => setShowReader((v) => !v)}
                          aria-expanded={showReader}
                          aria-controls="magazine-inline-reader"
                          className="btn-gold inline-flex items-center gap-2 px-6 py-3"
                        >
                          {showReader ? "Close reader" : "Read this issue"}
                          {showReader ? <X size={14} /> : <BookOpen size={14} />}
                        </button>
                      )}
                      {currentPdf && (
                        <a href={currentPdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[var(--aa-olive-dark)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aa-olive-dark)]">
                          Open in new tab <ExternalLink size={14} />
                        </a>
                      )}
                      {currentPdf && (
                        <a href={currentPdf} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-2 border border-[var(--aa-olive-dark)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aa-olive-dark)]">
                          Download <Download size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </article>

                {showReader && currentPdf && (
                  <div id="magazine-inline-reader" className="mt-6 grid grid-cols-1 gap-0 border border-[var(--aa-cream-dark)] bg-[#1F0A03] lg:grid-cols-[1fr_260px]">
                    <div className="order-2 lg:order-1">
                      <iframe
                        src={toInlineReaderUrl(currentPdf)}
                        title={`${current.title} — reader`}
                        className="h-[80vh] w-full bg-white"
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    </div>
                    <aside className="order-1 flex flex-col gap-4 p-5 text-[var(--aa-cream)] lg:order-2 lg:border-l lg:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="section-label !text-[var(--aa-gold)]">Reader</p>
                          <h4 className="font-serif text-xl leading-snug">{current.title}</h4>
                        </div>
                        <button type="button" onClick={() => setShowReader(false)} aria-label="Close reader" className="rounded border border-white/20 p-1 text-white/70 hover:bg-white/10">
                          <X size={14} />
                        </button>
                      </div>
                      <p className="text-xs leading-6 text-white/60">
                        Rendered inline via a public document viewer — no download required. Use the buttons below to open the source file if you prefer.
                      </p>
                      <div className="mt-auto flex flex-col gap-2">
                        <a href={currentPdf} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 bg-[var(--aa-gold)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--aa-olive-dark)]">
                          <ExternalLink size={13} /> Open in new tab
                        </a>
                        <a href={currentPdf} target="_blank" rel="noreferrer" download className="inline-flex items-center justify-center gap-2 border border-white/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-white/10">
                          <Download size={13} /> Download PDF
                        </a>
                      </div>
                    </aside>
                  </div>
                )}
              </section>


              <section>
                <div className="mb-6 border-b border-[var(--aa-cream-dark)] pb-4"><p className="section-label mb-2">Library</p><h2 className="font-serif text-4xl font-normal text-[var(--aa-olive-dark)]">Archive</h2></div>
                {archives.length === 0 ? (
                  <p className="border border-dashed border-[var(--aa-cream-dark)] p-8 text-sm text-[var(--aa-text-mid)]">Previous editions will appear here as they are published.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {archives.map((issue) => {
                      const pdf = normalizeDoc(issue.external_file_url);
                      const cover = normalizeDoc(issue.cover_image_path);
                      return (
                      <article key={issue.id} className="group flex flex-col border border-[var(--aa-cream-dark)] bg-white">
                        <button
                          type="button"
                          onClick={() => pdf && setPreviewIssue({ title: issue.title, url: pdf })}
                          disabled={!pdf}
                          className="relative h-[390px] overflow-hidden bg-[var(--aa-olive-dark)] text-left"
                          style={{ backgroundImage: cover ? `url('${cover}')` : "none", backgroundSize: "cover", backgroundPosition: "center" }}
                          aria-label={`Preview ${issue.title}`}
                        >
                          <div className="absolute inset-0 bg-black/15 transition group-hover:bg-black/40" />
                          {pdf && (
                            <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 bg-[var(--aa-gold)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--aa-olive-dark)] opacity-0 transition group-hover:opacity-100">
                              <Eye size={12} /> Preview
                            </span>
                          )}
                        </button>
                        <div className="flex-1 p-6">
                          {issue.published_on && <p className="section-label mb-2">{fmtDate(issue.published_on)}</p>}
                          <h3 className="font-serif text-2xl font-normal text-[var(--aa-olive-dark)]">{issue.title}</h3>
                          {pdf && (
                            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.14em]">
                              <button type="button" onClick={() => setPreviewIssue({ title: issue.title, url: pdf })} className="inline-flex items-center gap-2 font-semibold text-[var(--aa-olive-dark)] underline underline-offset-4">
                                <Eye size={12} /> View
                              </button>
                              <a href={pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-[var(--aa-text-mid)] underline underline-offset-4">
                                <ExternalLink size={12} /> New tab
                              </a>
                            </div>
                          )}
                        </div>
                      </article>
                      );
                    })}

                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {previewIssue && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${previewIssue.title} preview`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewIssue(null)}
          >
            <div
              className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden bg-[#1F0A03] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-[var(--aa-cream)]">
                <div>
                  <p className="section-label !text-[var(--aa-gold)]">Reader · view only</p>
                  <h4 className="font-serif text-xl">{previewIssue.title}</h4>
                </div>
                <button type="button" onClick={() => setPreviewIssue(null)} className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/80 hover:bg-white/10">
                  Close <X size={14} />
                </button>
              </div>
              <iframe
                src={toInlineReaderUrl(previewIssue.url)}
                title={`${previewIssue.title} — reader`}
                className="flex-1 w-full bg-white"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          </div>
        )}
      </main>
    </MemberLayout>
  );
}
