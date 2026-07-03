import { useEffect, useRef, useState } from "react";
import { ExternalLink, PlayCircle, RotateCw, AlertTriangle } from "lucide-react";
import {
  parseVideoUrl,
  stripQueryForDisplay,
  type ParsedVideo,
} from "@/manus/lib/video-url";

export type LessonPlayerProps = {
  videoUrl: string | null | undefined;
  title?: string;
  className?: string;
  /** Show discreet diagnostic info (provider, normalised URL, type). */
  isAdmin?: boolean;
  /** Persisted resume position in seconds (for html5 video). */
  initialPositionSeconds?: number | null;
  /** Called periodically with the current playback position (html5 video only). */
  onPositionChange?: (seconds: number) => void;
  /** Fired when playback reaches ~95% (html5 video only). */
  onNearComplete?: () => void;
};

/** Re-export so existing tests in LessonPlayer.test.tsx keep working. */
export function parseLessonVideo(raw: string | null | undefined): {
  kind: "youtube" | "vimeo" | "file" | "external" | "none";
  embed?: string;
  src?: string;
  mime?: string;
  href?: string;
} {
  const p = parseVideoUrl(raw);
  if (p.provider === "youtube") return { kind: "youtube", embed: p.embed };
  if (p.provider === "vimeo") return { kind: "vimeo", embed: p.embed };
  if (p.provider === "dropbox" || p.provider === "file") {
    return { kind: "file", src: p.src, mime: p.mime };
  }
  if (p.provider === "external") return { kind: "external", href: p.href };
  return { kind: "none" };
}

function AdminDiagnostics({ parsed }: { parsed: ParsedVideo }) {
  if (parsed.provider === "none") return null;
  const url =
    parsed.provider === "youtube" || parsed.provider === "vimeo"
      ? parsed.embed
      : parsed.provider === "dropbox" || parsed.provider === "file"
        ? parsed.src
        : parsed.href;
  const display = stripQueryForDisplay(url);
  const type =
    parsed.kind === "iframe" ? "iframe embed" : parsed.kind === "file" ? "html5 video" : "external link";
  return (
    <p className="mt-2 text-[11px] text-foreground/50 font-mono break-all" aria-label="Admin video diagnostics">
      provider={parsed.provider} · type={type} · url={display}
    </p>
  );
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
const RATE_STORAGE_KEY = "aa:lesson-playback-rate";

export default function LessonPlayer({
  videoUrl,
  title,
  className,
  isAdmin,
  initialPositionSeconds,
  onPositionChange,
  onNearComplete,
}: LessonPlayerProps) {
  const parsed = parseVideoUrl(videoUrl);
  const accessibleTitle = title?.trim() || "Lesson video";
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(parsed.provider !== "none" && parsed.provider !== "external");
  const [attempt, setAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nearCompleteFiredRef = useRef(false);
  const lastReportRef = useRef(0);
  const [rate, setRate] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const stored = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
    return PLAYBACK_RATES.includes(stored as (typeof PLAYBACK_RATES)[number]) ? stored : 1;
  });

  useEffect(() => {
    setErrored(false);
    setLoading(parsed.provider !== "none" && parsed.provider !== "external");
    nearCompleteFiredRef.current = false;
    lastReportRef.current = 0;
  }, [videoUrl, attempt, parsed.provider]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(rate));
    }
  }, [rate, attempt]);

  const handleLoadedMetadata = () => {
    setLoading(false);
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    if (initialPositionSeconds && initialPositionSeconds > 5 && v.duration > initialPositionSeconds + 5) {
      try { v.currentTime = initialPositionSeconds; } catch { /* ignore */ }
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const now = v.currentTime;
    if (onPositionChange && Math.abs(now - lastReportRef.current) > 10) {
      lastReportRef.current = now;
      onPositionChange(Math.floor(now));
    }
    if (onNearComplete && !nearCompleteFiredRef.current && v.duration > 0 && now / v.duration >= 0.95) {
      nearCompleteFiredRef.current = true;
      onNearComplete();
    }
  };

  const retry = () => {
    setErrored(false);
    setAttempt((n) => n + 1);
  };

  // === Error fallback ===
  if (errored && (parsed.provider === "dropbox" || parsed.provider === "file" || parsed.provider === "youtube" || parsed.provider === "vimeo")) {
    const externalHref =
      parsed.provider === "dropbox" || parsed.provider === "file"
        ? parsed.src
        : parsed.embed;
    return (
      <div
        className={`relative w-full aspect-video flex flex-col items-center justify-center gap-3 rounded-lg border border-border/50 bg-muted/30 text-foreground/70 p-6 text-center ${className ?? ""}`}
        role="alert"
      >
        <AlertTriangle className="w-6 h-6 text-amber-600" />
        <p className="text-sm font-medium">Unable to play this video.</p>
        {isAdmin && (
          <p className="text-xs text-foreground/60 max-w-sm">
            Confirm that the shared link allows public viewing.
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wider border border-border/60 px-3 py-1.5 rounded-md hover:bg-card"
          >
            <RotateCw className="w-3 h-3" /> Retry
          </button>
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wider border border-border/60 px-3 py-1.5 rounded-md hover:bg-card"
          >
            <ExternalLink className="w-3 h-3" /> Open externally
          </a>
        </div>
        {isAdmin && <AdminDiagnostics parsed={parsed} />}
      </div>
    );
  }

  if (parsed.provider === "youtube" || parsed.provider === "vimeo") {
    return (
      <div className={className}>
        <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            key={`${attempt}-${parsed.embed}`}
            src={parsed.embed}
            title={accessibleTitle}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            className="absolute inset-0 h-full w-full border-0"
            onLoad={() => setLoading(false)}
            onError={() => setErrored(true)}
          />
        </div>
        {isAdmin && <AdminDiagnostics parsed={parsed} />}
      </div>
    );
  }

  if (parsed.provider === "dropbox" || parsed.provider === "file") {
    return (
      <div className={className}>
        <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs animate-pulse">
              Loading video…
            </div>
          )}
          <video
            key={`${attempt}-${parsed.src}`}
            ref={videoRef}
            controls
            preload="metadata"
            playsInline
            aria-label={accessibleTitle}
            className="absolute inset-0 h-full w-full"
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => setLoading(false)}
            onTimeUpdate={handleTimeUpdate}
            onError={() => { setErrored(true); setLoading(false); }}
          >
            <source src={parsed.src} type={parsed.mime} />
            Your browser does not support embedded video.
          </video>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[11px] uppercase tracking-[0.12em] text-foreground/60">
          <span className="mr-1">Speed</span>
          {PLAYBACK_RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRate(r)}
              className={`rounded px-2 py-0.5 transition ${rate === r ? "bg-accent/15 text-accent" : "hover:bg-muted"}`}
              aria-pressed={rate === r}
            >
              {r}x
            </button>
          ))}
        </div>
        {isAdmin && <AdminDiagnostics parsed={parsed} />}
      </div>
    );
  }

  if (parsed.provider === "external") {
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
        {isAdmin && <AdminDiagnostics parsed={parsed} />}
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
