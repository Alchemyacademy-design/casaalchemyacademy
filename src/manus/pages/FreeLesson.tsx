import { Link } from "react-router-dom";

// Set FREE_LESSON_VIDEO_URL (or paste directly here) once Lorena confirms
// which video is the free-lesson gift. Supports YouTube, Vimeo, or a direct
// mp4 URL. Until then, the page shows a friendly placeholder so leads still
// land somewhere real.
const FREE_LESSON_VIDEO_URL: string | null =
  (import.meta.env.VITE_FREE_LESSON_VIDEO_URL as string | undefined) ?? null;

function isYouTube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
function isVimeo(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}

export default function FreeLesson() {
  const embed = FREE_LESSON_VIDEO_URL
    ? isYouTube(FREE_LESSON_VIDEO_URL) ?? isVimeo(FREE_LESSON_VIDEO_URL)
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--aa-cream, #f7f2ea)" }}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <p className="uppercase tracking-[0.2em] text-xs text-foreground/60 mb-4">Your free lesson</p>
        <h1 className="font-serif text-4xl md:text-5xl font-normal mb-4">Welcome to the Alchemy.</h1>
        <p className="text-foreground/70 max-w-2xl mb-10">
          Bookmark this page — you'll receive the same link by email so you can come back any time.
        </p>

        <div className="aspect-video rounded-lg overflow-hidden bg-black/90 shadow-lg">
          {embed ? (
            <iframe
              src={embed}
              title="Free lesson"
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : FREE_LESSON_VIDEO_URL ? (
            <video src={FREE_LESSON_VIDEO_URL} controls className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/80 text-center p-8">
              <p className="font-serif text-2xl mb-2">Your lesson is being prepared.</p>
              <p className="text-white/60 text-sm max-w-md">
                We'll email you as soon as the video is ready. In the meantime, feel free to explore the full method.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link
            to="/courses"
            className="inline-flex items-center justify-center rounded px-6 py-3 bg-foreground text-background font-medium"
          >
            Explore all courses
          </Link>
          <Link
            to="/quiz"
            className="inline-flex items-center justify-center rounded px-6 py-3 border border-foreground/20 font-medium"
          >
            Take the course quiz
          </Link>
        </div>
      </div>
    </div>
  );
}