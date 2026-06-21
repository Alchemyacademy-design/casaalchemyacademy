import { useMemo } from "react";
import { PlayCircle, AlertTriangle } from "lucide-react";

interface Props {
  url: string | null | undefined;
  className?: string;
}

function parseVideo(url: string): { kind: "youtube" | "vimeo" | "mp4" | "other"; embed?: string; thumb?: string } {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let id = "";
      if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
      else id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop() ?? "";
      if (id) return { kind: "youtube", embed: `https://www.youtube.com/embed/${id}`, thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return { kind: "vimeo", embed: `https://player.vimeo.com/video/${id}` };
    }
    // MP4 / direct video
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(u.pathname)) return { kind: "mp4" };
    return { kind: "other" };
  } catch {
    return { kind: "other" };
  }
}

export default function VideoPreview({ url, className = "" }: Props) {
  const parsed = useMemo(() => (url ? parseVideo(url) : null), [url]);

  if (!url) {
    return (
      <div className={`aspect-video bg-muted rounded flex items-center justify-center text-foreground/40 text-sm gap-2 ${className}`}>
        <PlayCircle className="w-5 h-5" /> No video URL yet
      </div>
    );
  }

  if (url.includes("/manus-storage/") || url.includes("placeholder-video")) {
    return (
      <div className={`aspect-video bg-amber-50 border border-amber-200 text-amber-800 rounded flex items-center justify-center text-sm gap-2 ${className}`}>
        <AlertTriangle className="w-4 h-4" /> Placeholder Manus URL — replace with real link
      </div>
    );
  }

  if (parsed?.kind === "youtube" || parsed?.kind === "vimeo") {
    return (
      <iframe
        src={parsed.embed}
        className={`aspect-video w-full rounded ${className}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video preview"
      />
    );
  }

  if (parsed?.kind === "mp4") {
    return <video src={url} controls className={`aspect-video w-full rounded bg-black ${className}`} />;
  }

  return (
    <div className={`aspect-video bg-muted rounded flex items-center justify-center text-foreground/60 text-sm ${className}`}>
      <a href={url} target="_blank" rel="noreferrer" className="underline">Open external link</a>
    </div>
  );
}
