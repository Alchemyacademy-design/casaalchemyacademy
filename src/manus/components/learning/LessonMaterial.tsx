import { ExternalLink, FileText } from "lucide-react";

export type LessonMaterialProps = {
  url: string | null | undefined;
  label?: string | null;
};

type Parsed =
  | { kind: "valid"; href: string; hostname: string; ext: string | null }
  | { kind: "none" };

export function parseLessonResource(rawUrl: string | null | undefined): Parsed {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) return { kind: "none" };
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { kind: "none" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "none" };
  const ext = url.pathname.includes(".") ? url.pathname.split(".").pop()!.toLowerCase() : null;
  return {
    kind: "valid",
    href: url.toString(),
    hostname: url.hostname.replace(/^www\./, ""),
    ext: ext && ext.length <= 5 ? ext : null,
  };
}

export default function LessonMaterial({ url, label }: LessonMaterialProps) {
  const parsed = parseLessonResource(url);

  if (parsed.kind === "none") {
    return (
      <p className="text-xs text-foreground/55" role="status">
        No supporting material for this lesson.
      </p>
    );
  }

  const friendly = label?.trim() || `Resource on ${parsed.hostname}`;
  return (
    <a
      href={parsed.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-border/50 bg-card/50 px-3 py-2 text-sm text-foreground/80 hover:bg-card transition"
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate">{friendly}</span>
      <span className="text-[10px] uppercase tracking-wider text-foreground/55">
        {parsed.ext ?? parsed.hostname}
      </span>
      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
    </a>
  );
}
