import { ExternalLink, PlayCircle } from "lucide-react";

export type LessonPlayerProps = {
  videoUrl: string | null | undefined;
  title?: string;
  /** Optional poster image url for the empty / unknown states. */
  className?: string;
};

type Parsed =
  | { kind: "youtube"; embed: string }
  | { kind: "vimeo"; embed: string }
  | { kind: "file"; src: string; mime: string }
  | { kind: "external"; href: string }
  | { kind: "none" };

const FILE_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
};

export function parseLessonVideo(rawUrl: string | null | undefined): Parsed {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) return { kind: "none" };
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { kind: "none" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "none" };
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (id && /^[\w-]{6,20}$/.test(id)) {
        return { kind: "youtube", embed: `https://www.youtube.com/embed/${id}` };
      }
    }
    const embedMatch = url.pathname.match(/^\/embed\/([\w-]{6,20})/);
    if (embedMatch) return { kind: "youtube", embed: `https://www.youtube.com/embed/${embedMatch[1]}` };
    const shortMatch = url.pathname.match(/^\/shorts\/([\w-]{6,20})/);
    if (shortMatch) return { kind: "youtube", embed: `https://www.youtube.com/embed/${shortMatch[1]}` };
  }
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "");
    if (/^[\w-]{6,20}$/.test(id)) {
      return { kind: "youtube", embed: `https://www.youtube.com/embed/${id}` };
    }
  }

  // Vimeo
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return { kind: "vimeo", embed: `https://player.vimeo.com/video/${id}` };
    }
  }
  if (host === "player.vimeo.com") {
    const match = url.pathname.match(/^\/video\/(\d+)/);
    if (match) return { kind: "vimeo", embed: `https://player.vimeo.com/video/${match[1]}` };
  }

  // Direct file
  const ext = url.pathname.split(".").pop()?.toLowerCase() ?? "";
  if (ext in FILE_MIME) {
    return { kind: "file", src: url.toString(), mime: FILE_MIME[ext] };
  }

  // Recognised http(s) but not embeddable — offer safe external link.
  return { kind: "external", href: url.toString() };
}

export default function LessonPlayer({ videoUrl, title, className }: LessonPlayerProps) {
  const parsed = parseLessonVideo(videoUrl);
  const accessibleTitle = title?.trim() || "Lesson video";

  if (parsed.kind === "youtube" || parsed.kind === "vimeo") {
    return (
      <div className={`relative w-full aspect-video overflow-hidden rounded-lg bg-black ${className ?? ""}`}>
        <iframe
          src={parsed.embed}
          title={accessibleTitle}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  if (parsed.kind === "file") {
    return (
      <div className={`relative w-full aspect-video overflow-hidden rounded-lg bg-black ${className ?? ""}`}>
        <video
          controls
          preload="metadata"
          aria-label={accessibleTitle}
          className="absolute inset-0 h-full w-full"
        >
          <source src={parsed.src} type={parsed.mime} />
          Your browser does not support embedded video.
        </video>
      </div>
    );
  }

  if (parsed.kind === "external") {
    return (
      <div
        className={`relative w-full aspect-video flex items-center justify-center rounded-lg border border-border/50 bg-muted/30 ${className ?? ""}`}
        role="region"
        aria-label="External video"
      >
        <a
          href={parsed.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground"
        >
          <ExternalLink className="w-4 h-4" /> Open video externally
        </a>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full aspect-video flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/20 text-foreground/60 ${className ?? ""}`}
      role="status"
    >
      <PlayCircle className="w-8 h-8 opacity-50" />
      <p className="text-xs">Video coming soon</p>
    </div>
  );
}
