import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Eye, FileQuestion, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import AdminShell from "@/manus/components/admin/AdminShell";
import QuizCard from "@/manus/components/learning/QuizCard";
import { QuizEditor } from "@/manus/components/admin/AdminQuizEditor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

type Scope = "lesson" | "module" | "course";

type QuizListRow = {
  id: number;
  title: string;
  status: string;
  course_id: number;
  lesson_id: number | null;
  module_id: number | null;
  passing_score: number;
  question_count: number;
  course_title: string | null;
  scope_label: string;
};

type Course = { id: number; title: string };
type Module = { id: number; title: string; course_id: number };
type Lesson = { id: number; title: string; module_id: number };

async function fetchCatalog() {
  const [{ data: courses }, { data: modules }, { data: lessons }] = await Promise.all([
    db.from("courses").select("id,title").order("title"),
    db.from("course_modules").select("id,title,course_id").order("sort_order"),
    db.from("lessons").select("id,title,module_id").order("sort_order"),
  ]);
  return {
    courses: (courses ?? []) as Course[],
    modules: (modules ?? []) as Module[],
    lessons: (lessons ?? []) as Lesson[],
  };
}

async function fetchQuizList(): Promise<QuizListRow[]> {
  const { data: quizzes, error } = await db
    .from("quizzes")
    .select("id,title,status,course_id,lesson_id,module_id,passing_score")
    .order("id", { ascending: false });
  if (error) throw error;
  const rows = (quizzes ?? []) as Array<Omit<QuizListRow, "question_count" | "course_title" | "scope_label">>;
  const ids = rows.map((r) => r.id);
  const counts = new Map<number, number>();
  if (ids.length) {
    const { data: qs } = await db.from("quiz_questions").select("quiz_id").in("quiz_id", ids);
    for (const r of (qs ?? []) as Array<{ quiz_id: number }>) {
      counts.set(r.quiz_id, (counts.get(r.quiz_id) ?? 0) + 1);
    }
  }
  const courseIds = Array.from(new Set(rows.map((r) => r.course_id)));
  const titles = new Map<number, string>();
  if (courseIds.length) {
    const { data: cs } = await db.from("courses").select("id,title").in("id", courseIds);
    for (const c of (cs ?? []) as Course[]) titles.set(c.id, c.title);
  }
  return rows.map((r) => ({
    ...r,
    question_count: counts.get(r.id) ?? 0,
    course_title: titles.get(r.course_id) ?? null,
    scope_label: r.lesson_id
      ? `Lesson #${r.lesson_id}`
      : r.module_id
      ? `Module exam #${r.module_id}`
      : "Course final exam",
  }));
}

function NewQuizForm({ courses, modules, lessons, onCreated }: {
  courses: Course[];
  modules: Module[];
  lessons: Lesson[];
  onCreated: (quizId: number) => void;
}) {
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState<number | null>(null);
  const [scope, setScope] = useState<Scope>("lesson");
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passing, setPassing] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState<string>("");

  const filteredModules = useMemo(
    () => modules.filter((m) => m.course_id === courseId),
    [modules, courseId],
  );
  const courseLessons = useMemo(() => {
    const modIds = new Set(filteredModules.map((m) => m.id));
    return lessons.filter((l) => modIds.has(l.module_id));
  }, [lessons, filteredModules]);

  const create = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("Choose a course");
      if (!title.trim()) throw new Error("Give the quiz a title");
      if (scope === "lesson" && !lessonId) throw new Error("Choose a lesson");
      if (scope === "module" && !moduleId) throw new Error("Choose a module");
      const payload = {
        course_id: courseId,
        lesson_id: scope === "lesson" ? lessonId : null,
        module_id: scope === "module" ? moduleId : null,
        title: title.trim(),
        description: description.trim() || null,
        passing_score: Math.min(100, Math.max(0, passing)),
        max_attempts: maxAttempts ? Math.max(1, Number(maxAttempts)) : null,
        status: "draft",
      };
      const { data, error } = await db.from("quizzes").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as number;
    },
    onSuccess: (id) => {
      toast.success("Quiz created — now add questions.");
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["admin-quiz-list"] });
      onCreated(id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Card className="p-5 space-y-4">
      <h2 className="font-semibold">New quiz</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Course</Label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={courseId ?? ""}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setCourseId(v ? Number(v) : null);
              setModuleId(null);
              setLessonId(null);
            }}
          >
            <option value="">— select —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Knowledge check title" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Scope</Label>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="grid sm:grid-cols-3 gap-2 mt-1">
          <label className="flex items-center gap-2 border rounded p-2 text-sm cursor-pointer">
            <RadioGroupItem value="lesson" /> Lesson quiz
          </label>
          <label className="flex items-center gap-2 border rounded p-2 text-sm cursor-pointer">
            <RadioGroupItem value="module" /> Module exam
          </label>
          <label className="flex items-center gap-2 border rounded p-2 text-sm cursor-pointer">
            <RadioGroupItem value="course" /> Course final exam
          </label>
        </RadioGroup>
      </div>

      {scope === "lesson" && (
        <div>
          <Label className="text-xs">Lesson</Label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={lessonId ?? ""}
            onChange={(e) => setLessonId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
            disabled={!courseId}
          >
            <option value="">— select —</option>
            {courseLessons.map((l) => {
              const mod = filteredModules.find((m) => m.id === l.module_id);
              return (
                <option key={l.id} value={l.id}>
                  {mod?.title} · {l.title}
                </option>
              );
            })}
          </select>
        </div>
      )}
      {scope === "module" && (
        <div>
          <Label className="text-xs">Module</Label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={moduleId ?? ""}
            onChange={(e) => setModuleId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
            disabled={!courseId}
          >
            <option value="">— select —</option>
            {filteredModules.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Passing score (%)</Label>
          <Input type="number" min={0} max={100} value={passing} onChange={(e) => setPassing(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label className="text-xs">Max attempts (blank = unlimited)</Label>
          <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
        <Plus className="w-3 h-3 mr-1" /> Create quiz
      </Button>
    </Card>
  );
}

export function AdminQuizzesInner({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ["admin-quiz-catalog"], queryFn: fetchCatalog });
  const listQuery = useQuery({ queryKey: ["admin-quiz-list"], queryFn: fetchQuizList });
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ quizId: number; courseId: number } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (quizId: number) => {
      const { error } = await db.from("quizzes").delete().eq("id", quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quiz deleted");
      qc.invalidateQueries({ queryKey: ["admin-quiz-list"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const rows = listQuery.data ?? [];

  const body = (
    <>
      <NewQuizForm
        courses={catalog.data?.courses ?? []}
        modules={catalog.data?.modules ?? []}
        lessons={catalog.data?.lessons ?? []}
        onCreated={(id) => {
          const row = (listQuery.data ?? []).find((r) => r.id === id);
          // The just-created quiz may not be in listQuery yet; refetch will bring it.
          // We still need courseId — the form captured it, but we don't have it here.
          // Fall back: open editor once list refreshes by remembering id.
          if (row) setEditing({ quizId: row.id, courseId: row.course_id });
          else {
            // Optimistic: fetch this quiz's course_id directly.
            db.from("quizzes").select("course_id").eq("id", id).single().then(
              ({ data }: { data: { course_id: number } | null }) => {
                if (data) setEditing({ quizId: id, courseId: data.course_id });
              },
            );
          }
        }}
      />

      <Card className="p-0 overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="text-left p-3">Quiz</th>
              <th className="text-left p-3">Course</th>
              <th className="text-left p-3">Scope</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Qs</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-foreground/60">Loading…</td></tr>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-foreground/60">No quizzes yet. Create one above.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.title}</td>
                <td className="p-3">
                  <Link to={`/admin/courses/${r.course_id}`} className="hover:underline inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {r.course_title ?? `#${r.course_id}`}
                  </Link>
                </td>
                <td className="p-3 text-xs">{r.scope_label}</td>
                <td className="p-3">
                  <Badge variant={r.status === "published" ? "default" : "secondary"}>{r.status}</Badge>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1"><FileQuestion className="w-3 h-3" /> {r.question_count}</span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing((cur) =>
                        cur?.quizId === r.id ? null : { quizId: r.id, courseId: r.course_id },
                      )
                    }
                  >
                    {editing?.quizId === r.id ? "Editing" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewId((id) => (id === r.id ? null : r.id))}>
                    <Eye className="w-3 h-3 mr-1" />
                    {previewId === r.id ? "Hide" : "Preview"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${r.title}"? This removes all its questions and attempts.`)) {
                        deleteMutation.mutate(r.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {previewId != null && (
        <Card className="p-5 mt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-foreground/60">
            Preview · no attempt is recorded
          </p>
          <QuizCard quizId={previewId} previewAsAdmin />
        </Card>
      )}

      {editing && (
        <div className="mt-4">
          <QuizEditor
            quizId={editing.quizId}
            courseId={editing.courseId}
            onClose={() => setEditing(null)}
          />
        </div>
      )}
    </>
  );
  if (embedded) return body;
  return (
    <AdminShell
      crumbs={[{ label: "Admin", to: "/admin" }, { label: "Quizzes" }]}
      title="Quizzes"
      description="Create knowledge checks for lessons, module exams, or a course final exam. Published quizzes render for members automatically."
    >
      {body}
    </AdminShell>
  );
}

export default function AdminQuizzes() { return <AdminQuizzesInner />; }
