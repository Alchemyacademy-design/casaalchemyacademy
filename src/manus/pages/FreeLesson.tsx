import { Link } from "react-router-dom";
import BackNav from "@/manus/components/BackNav";
import lessonBanner from "@/assets/how-to-mix-prints-banner.png.asset.json";

// Free lesson video (Dropbox direct stream — `raw=1` serves the file itself).
const LESSON_VIDEO_URL: string =
  (import.meta.env.VITE_FREE_LESSON_VIDEO_URL as string | undefined) ??
  "https://www.dropbox.com/scl/fi/sqlkz21s0kfeq37neolat/how-to-mix-prints.mp4?rlkey=xytd5hqcruap575dftwk3fc1h&raw=1";

export default function FreeLesson() {
  return (
    <div className="min-h-screen" style={{ background: "var(--aa-cream, #f7f2ea)" }}>
      <BackNav variant="top" />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="uppercase tracking-[0.2em] text-xs text-foreground/60 mb-4">Your free lesson</p>
        <h1 className="font-serif text-4xl md:text-5xl font-normal mb-4">
          Thanks for subscribing. Here's your lesson.
        </h1>
        <p className="text-foreground/70 max-w-2xl mb-10">
          <em>How to Mix Prints</em> with Lorena Couto is ready to watch below. We've also sent the same link to your inbox so you can come back to it any time.
        </p>

        <div className="rounded-lg overflow-hidden shadow-lg bg-black mb-10">
          <video
            src={LESSON_VIDEO_URL}
            poster={lessonBanner.url}
            controls
            playsInline
            preload="metadata"
            className="w-full h-auto block aspect-video"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-normal mb-3">
              Real projects. Real principles.
            </h2>
            <p className="text-foreground/70 mb-6 leading-relaxed">
              In this lesson: how to combine patterns, scale and colour without the room fighting itself — the same professional lens we teach inside the Academy.
            </p>

            <a
              href={LESSON_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded px-6 py-3 bg-foreground text-background font-medium"
            >
              Open the lesson in a new tab
            </a>
          </div>

          <div>
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
      <BackNav variant="bottom" />
    </div>
  );
}