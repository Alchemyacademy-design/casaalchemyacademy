import { useEffect, useState } from "react";
import { NotebookPen, Check, Loader2 } from "lucide-react";
import { useLessonNote, useSaveLessonNote } from "@/manus/hooks/useLessonNotes";

export default function LessonNotes({ lessonId }: { lessonId: number | null }) {
  const { data, isLoading } = useLessonNote(lessonId);
  const save = useSaveLessonNote(lessonId);
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(data?.body ?? "");
    setDirty(false);
  }, [data?.body, lessonId]);

  useEffect(() => {
    if (!dirty || !lessonId) return;
    const t = setTimeout(() => {
      save.mutate(value, { onSuccess: () => setDirty(false) });
    }, 900);
    return () => clearTimeout(t);
  }, [value, dirty, lessonId, save]);

  if (!lessonId) return null;

  return (
    <section className="aa-panel p-5" aria-label="Your notes">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-accent" />
          <h3 className="font-serif text-lg text-primary">Your notes</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {save.isPending ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
          ) : dirty ? (
            "Unsaved"
          ) : (
            <><Check className="h-3 w-3 text-accent" /> Saved</>
          )}
        </span>
      </div>
      <textarea
        value={value}
        disabled={isLoading}
        onChange={(e) => { setValue(e.target.value); setDirty(true); }}
        placeholder="Capture takeaways, questions, next actions…"
        className="min-h-[140px] w-full resize-y rounded-md border border-border bg-background p-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="mt-2 text-[11px] text-muted-foreground">Notes are private to you and autosave.</p>
    </section>
  );
}