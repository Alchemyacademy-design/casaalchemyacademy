import { CheckCircle2, Circle, HelpCircle, Lock, PlayCircle } from "lucide-react";

export type SidebarLesson = {
  id: number;
  title: string;
  number?: number | string | null;
  locked?: boolean;
  hasQuiz?: boolean;
};

export type LessonSidebarProps = {
  lessons: ReadonlyArray<SidebarLesson>;
  activeLessonId: number | null;
  completedLessonIds: ReadonlySet<number>;
  onSelect: (lessonId: number) => void;
  heading?: string;
};

export default function LessonSidebar({
  lessons,
  activeLessonId,
  completedLessonIds,
  onSelect,
  heading = "Lessons",
}: LessonSidebarProps) {
  if (lessons.length === 0) {
    return (
      <div className="p-4 text-xs text-foreground/55">No lessons yet.</div>
    );
  }
  return (
    <div>
      <h3 className="font-semibold mb-3 text-sm">{heading}</h3>
      <ul className="space-y-1" role="list">
        {lessons.map((l) => {
          const isCompleted = completedLessonIds.has(l.id);
          const isActive = activeLessonId === l.id;
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onSelect(l.id)}
                aria-current={isActive ? "true" : undefined}
                className={`w-full text-left px-3 py-2 rounded-md transition flex items-center gap-3 text-sm ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/60 text-foreground/85"
                }`}
              >
                {l.locked ? (
                  <Lock className="w-4 h-4 flex-shrink-0 opacity-70" aria-hidden="true" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="w-4 h-4 flex-shrink-0 opacity-70" aria-hidden="true" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-70">
                    {l.number != null ? <span>Lesson {l.number}</span> : null}
                    {l.hasQuiz ? (
                      <span className="inline-flex items-center gap-1" title="Lesson quiz">
                        <HelpCircle className="h-3 w-3" aria-hidden="true" /> Quiz
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate font-medium">{l.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
