import { PlayCircle, AlertTriangle } from "lucide-react";
import { parseVideoUrl } from "@/manus/lib/video-url";

interface Props {
  url: string | null | undefined;
  className?: string;
}

export default function VideoPreview({ url, className = "" }: Props) {
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
        <AlertTriangle className="w-4 h-4" /> Placeholder URL — replace with the real link
      </div>
    );
  }

  const parsed = parseVideoUrl(url);

  if (parsed.provider === "youtube" || parsed.provider === "vimeo") {
    return (
      <iframe
        src={parsed.embed}
        className={`aspect-video w-full rounded ${className}`}
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        title="Video preview"
      />
    );
  }

  if (parsed.provider === "dropbox" || parsed.provider === "file") {
    return (
      <video
        src={parsed.src}
        controls
        playsInline
        preload="metadata"
        className={`aspect-video w-full rounded bg-black ${className}`}
      />
    );
  }

  return (
    <div className={`aspect-video bg-muted rounded flex items-center justify-center text-foreground/60 text-sm ${className}`}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Open external link</a>
    </div>
  );
}
