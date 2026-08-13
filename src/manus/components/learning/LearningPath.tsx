import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Lock, PlayCircle } from "lucide-react";
import { resolveAssetUrl } from "@/manus/lib/asset-url";

export type PathLesson = {
  id: number;
  title: string;
  locked?: boolean;
  completed?: boolean;
  thumbnailPath?: string | null;
};

export type PathModule = {
  id: number;
  title: string;
  description?: string | null;
  lessons: ReadonlyArray<PathLesson>;
};

export type LearningPathProps = {
  modules: ReadonlyArray<PathModule>;
  activeLessonId?: number | null;
  buildLessonHref: (moduleId: number, lessonId: number) => string;
};

export default function LearningPath({ modules, activeLessonId, buildLessonHref }: LearningPathProps) {
  if (modules.length === 0) {
    return <p className="text-sm text-foreground/60">No modules published yet.</p>;
  }
  return (
    <ol className="space-y-4" aria-label="Learning path">
      {modules.map((mod, mi) => (
        <li key={mod.id} className="rounded-lg border border-border/50 bg-card/40 p-4">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-serif text-lg text-primary/80" aria-hidden="true">
              {String(mi + 1).padStart(2, "0")}
            </span>
            <h3 className="font-serif text-lg text-foreground">{mod.title}</h3>
          </div>
          {mod.description && (
            <p className="text-xs text-foreground/65 mb-3">{mod.description}</p>
          )}
          <ul className="space-y-1">
            {mod.lessons.map((l) => {
              const Icon = l.locked ? Lock : l.completed ? CheckCircle2 : activeLessonId === l.id ? PlayCircle : Circle;
              const thumb = resolveAssetUrl(l.thumbnailPath);
              const inner = thumb ? (
                <span className="flex items-center gap-3 text-sm">
                  <span className="relative block w-24 shrink-0 overflow-hidden rounded-md border border-border/50 sm:w-28">
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className={`aspect-video w-full object-cover ${l.locked ? "opacity-50" : ""}`}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/85 shadow-sm">
                      <Icon
                        className={`h-3.5 w-3.5 ${l.completed ? "text-emerald-500" : "text-foreground/70"}`}
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                  <span className={l.locked ? "text-foreground/55" : "text-foreground/85"}>{l.title}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm">
                  <Icon className={`w-4 h-4 ${l.completed ? "text-emerald-500" : "text-foreground/55"}`} aria-hidden="true" />
                  <span className={l.locked ? "text-foreground/55" : "text-foreground/85"}>{l.title}</span>
                </span>
              );
              return (
                <li key={l.id}>
                  {l.locked ? (
                    inner
                  ) : (
                    <Link
                      to={buildLessonHref(mod.id, l.id)}
                      className="block px-2 py-1 rounded hover:bg-muted/60 transition"
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
            {mod.lessons.length === 0 && (
              <li className="text-[11px] text-foreground/55 px-2">No lessons.</li>
            )}
          </ul>
        </li>
      ))}
    </ol>
  );
}
