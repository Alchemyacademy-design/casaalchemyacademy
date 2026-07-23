import { Link } from "react-router-dom";

// Once the final PDF + cover are uploaded (see docs — either place them at
// /public/lead-magnet/ with these exact filenames, or set the VITE_MAGAZINE_*
// env vars to the uploaded CDN URLs), this page will link straight to them.
const MAGAZINE_PDF_URL: string =
  (import.meta.env.VITE_MAGAZINE_PDF_URL as string | undefined) ??
  "/lead-magnet/casa-alchemy-issue-01.pdf";
const MAGAZINE_COVER_URL: string =
  (import.meta.env.VITE_MAGAZINE_COVER_URL as string | undefined) ??
  "/lead-magnet/magazine-cover.jpg";

export default function FreeLesson() {
  return (
    <div className="min-h-screen" style={{ background: "var(--aa-cream, #f7f2ea)" }}>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="uppercase tracking-[0.2em] text-xs text-foreground/60 mb-4">Your free issue</p>
        <h1 className="font-serif text-4xl md:text-5xl font-normal mb-4">
          Thanks for subscribing. Here's your issue.
        </h1>
        <p className="text-foreground/70 max-w-2xl mb-10">
          Your copy of the latest Casa Alchemy magazine is ready to download. We've also sent the same link to your inbox so you can come back to it any time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="rounded-lg overflow-hidden shadow-lg bg-black/5 aspect-[3/4]">
            <img
              src={MAGAZINE_COVER_URL}
              alt="Casa Alchemy magazine — latest issue cover"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-normal mb-3">
              Real projects. Real principles.
            </h2>
            <p className="text-foreground/70 mb-6 leading-relaxed">
              Inside this issue: case studies, material notes, and practical prompts you can apply to your own home — the same professional lens we teach inside the Academy.
            </p>

            <a
              href={MAGAZINE_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded px-6 py-3 bg-foreground text-background font-medium"
            >
              Download the magazine (PDF)
            </a>

            <div className="mt-10 pt-6 border-t border-foreground/10">
              <p className="text-foreground/70 mb-3">
                Want the full toolkit, not just the preview?
              </p>
              <Link
                to="/#offers"
                className="inline-flex items-center justify-center rounded px-6 py-3 border border-foreground/20 font-medium"
              >
                Explore membership & courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}