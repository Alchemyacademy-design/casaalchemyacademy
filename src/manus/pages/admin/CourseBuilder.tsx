import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, GripVertical, MoreVertical, Copy, Trash2, EyeOff, Eye, Save, Rocket,
} from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getCourse, updateCourse, createModule, createLesson, updateModule, updateLesson, archiveModule, archiveLesson } from "@/manus/lib/admin-content";
import { listModulesFull, listLessonsFull, reorderModules, reorderLessons, duplicateModule, duplicateLesson, toggleModuleVisibility, toggleLessonVisibility, publishCourse } from "@/manus/lib/course-management";
import type { Course, Module, Lesson } from "@/manus/lib/admin-content";
import AdminQuizEditor from "@/manus/components/admin/AdminQuizEditor";
import { PREVIEW_PLAN_LABELS, setPreviewPlan, type PreviewPlan } from "@/manus/lib/admin-preview";

type Selection = { kind: "module" | "lesson"; id: number } | null;

export default function CourseBuilder() {
  const { id: idParam } = useParams();
  const courseId = Number(idParam);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ["cb-course", courseId], queryFn: () => getCourse(courseId), enabled: Number.isFinite(courseId),
  });
  const { data: modules = [], refetch: refetchModules } = useQuery({
    queryKey: ["cb-modules", courseId], queryFn: () => listModulesFull(courseId), enabled: Number.isFinite(courseId),
  });
  const moduleIds = modules.map((m) => m.id);
  const { data: lessons = [], refetch: refetchLessons } = useQuery({
    queryKey: ["cb-lessons", moduleIds.join(",")], queryFn: () => listLessonsFull(moduleIds), enabled: moduleIds.length > 0,
  });

  const [sel, setSel] = useState<Selection>(null);
  const [confirm, setConfirm] = useState<{ kind: "module" | "lesson"; id: number; title: string } | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cb-modules", courseId] });
    qc.invalidateQueries({ queryKey: ["cb-lessons"] });
  };

  const publishM = useMutation({
    mutationFn: () => publishCourse(courseId, { immediate: true }),
    onSuccess: () => { toast.success("Course published"); qc.invalidateQueries({ queryKey: ["cb-course", courseId] }); },
    onError: (e: Error) => toast.error("Publish failed", { description: e.message }),
  });

  if (loadingCourse) return <AdminShell title="Course Builder"><p>Loading…</p></AdminShell>;
  if (!course) return <AdminShell title="Course Builder"><p>Course not found.</p></AdminShell>;

  return (
    <AdminShell
      title={course.title}
      description={course.subtitle ?? undefined}
      crumbs={[{ label: "Course Management", to: "/admin/course-management" }, { label: course.title }]}
      actions={
        <>
          <ViewAsMemberButton courseId={course.id} />
          <Button onClick={() => publishM.mutate()} disabled={publishM.isPending}><Rocket className="w-4 h-4 mr-2" /> Publish</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr,320px] gap-4">
        {/* LEFT — Structure */}
        <StructureColumn
          courseId={courseId}
          modules={modules}
          lessons={lessons}
          sel={sel}
          onSelect={setSel}
          onChanged={invalidate}
          onDeleteRequest={setConfirm}
          refetchModules={refetchModules}
          refetchLessons={refetchLessons}
        />

        {/* CENTER — Editor */}
        <div className="rounded-lg border border-border bg-card p-6 min-h-[400px]">
          {(() => {
            const selLesson = sel?.kind === "lesson" ? lessons.find((l) => l.id === sel.id) : null;
            const selModule = sel?.kind === "module" ? modules.find((m) => m.id === sel.id) : null;
            if (sel?.kind === "lesson" && selLesson) return <LessonEditor lesson={selLesson} onSaved={invalidate} />;
            if (sel?.kind === "module" && selModule) return <ModuleEditor module={selModule} onSaved={invalidate} />;
            if (sel && !selLesson && !selModule) {
              return <div className="text-sm text-muted-foreground">Loading selection…</div>;
            }
            return <CourseOverview course={course} onSaved={() => qc.invalidateQueries({ queryKey: ["cb-course", courseId] })} />;
          })()}
        </div>

        {/* RIGHT — Settings */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-medium text-sm uppercase tracking-wide text-foreground/60 mb-3">Quick settings</h3>
          <p className="text-xs text-foreground/60">
            Select a module or lesson on the left to configure release rules, prerequisites, comments and downloads.
          </p>
        </div>
      </div>

      {/* Quiz builder — full CRUD for lesson / module / course-scoped quizzes */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Quizzes</h2>
          <p className="text-xs text-foreground/60">
            Build quizzes attached to a lesson, a module (module-final exam) or the whole course. Members see them inline in the lesson player.
          </p>
        </div>
        <AdminQuizEditor courseId={courseId} />
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirm?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a soft delete — the item is archived and can be restored from the database. Existing student progress is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirm) return;
                try {
                  if (confirm.kind === "module") await archiveModule(confirm.id);
                  else await archiveLesson(confirm.id);
                  toast.success("Removed");
                  invalidate(); setSel(null);
                } catch (e) { toast.error("Delete failed", { description: (e as Error).message }); }
                finally { setConfirm(null); }
              }}
            >Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function StructureColumn({
  courseId, modules, lessons, sel, onSelect, onChanged, onDeleteRequest, refetchModules, refetchLessons,
}: {
  courseId: number;
  modules: Module[]; lessons: Lesson[];
  sel: Selection; onSelect: (s: Selection) => void; onChanged: () => void;
  onDeleteRequest: (c: { kind: "module" | "lesson"; id: number; title: string }) => void;
  refetchModules: () => void; refetchLessons: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const addModule = async () => {
    const next = (modules[modules.length - 1]?.sort_order ?? 0) + 1;
    try { const m = await createModule(courseId, next); onSelect({ kind: "module", id: m.id }); refetchModules(); }
    catch (e) { toast.error("Add module failed", { description: (e as Error).message }); }
  };

  const onModuleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(modules, oldIndex, newIndex);
    try { await reorderModules(next.map((m) => m.id)); refetchModules(); }
    catch { toast.error("Reorder failed"); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Structure</h3>
        <Button size="sm" variant="outline" onClick={addModule}><Plus className="w-3 h-3 mr-1" /> Module</Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onModuleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {modules.map((m) => (
              <ModuleNode
                key={m.id}
                module={m}
                lessons={lessons.filter((l) => l.module_id === m.id)}
                sel={sel}
                onSelect={onSelect}
                onChanged={onChanged}
                onDeleteRequest={onDeleteRequest}
                refetchLessons={refetchLessons}
                refetchModules={refetchModules}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {modules.length === 0 && <p className="text-xs text-foreground/60 mt-3">No modules yet. Add one to get started.</p>}
    </div>
  );
}

function ModuleNode({
  module, lessons, sel, onSelect, onChanged, onDeleteRequest, refetchLessons, refetchModules,
}: {
  module: Module; lessons: Lesson[]; sel: Selection;
  onSelect: (s: Selection) => void; onChanged: () => void;
  onDeleteRequest: (c: { kind: "module" | "lesson"; id: number; title: string }) => void;
  refetchLessons: () => void; refetchModules: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: module.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 };

  const addLesson = async () => {
    const next = (lessons[lessons.length - 1]?.sort_order ?? 0) + 1;
    try { const l = await createLesson(module.id, next); onSelect({ kind: "lesson", id: l.id }); refetchLessons(); }
    catch (e) { toast.error("Add lesson failed", { description: (e as Error).message }); }
  };

  const onLessonDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(lessons, oldIndex, newIndex);
    try { await reorderLessons(module.id, next.map((l) => l.id)); refetchLessons(); }
    catch { toast.error("Reorder failed"); }
  };

  const isSelected = sel?.kind === "module" && sel.id === module.id;

  return (
    <li ref={setNodeRef} style={style} className="border border-border rounded bg-background">
      <div className={`flex items-center gap-1 p-2 ${isSelected ? "bg-muted" : ""}`}>
        <button {...attributes} {...listeners} className="text-foreground/40 hover:text-foreground/80 cursor-grab"><GripVertical className="w-4 h-4" /></button>
        <button className="flex-1 text-left text-sm font-medium truncate" onClick={() => onSelect({ kind: "module", id: module.id })}>
          {module.title}
        </button>
        <StatusBadge status={module.status} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={addLesson}><Plus className="w-4 h-4 mr-2" /> Add lesson</DropdownMenuItem>
            <DropdownMenuItem onClick={async () => { try { await duplicateModule(module.id); toast.success("Duplicated"); refetchModules(); refetchLessons(); } catch (e) { toast.error("Duplicate failed", { description: (e as Error).message }); } }}><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={async () => { try { await toggleModuleVisibility(module.id, module.status === "published"); refetchModules(); } catch (e) { toast.error("Update failed", { description: (e as Error).message }); } }}>
              {module.status === "published" ? <><EyeOff className="w-4 h-4 mr-2" /> Hide</> : <><Eye className="w-4 h-4 mr-2" /> Publish</>}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDeleteRequest({ kind: "module", id: module.id, title: module.title })}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="pl-6 pr-2 pb-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLessonDragEnd}>
          <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {lessons.map((l) => (
                <LessonNode key={l.id} lesson={l} selected={sel?.kind === "lesson" && sel.id === l.id} onSelect={() => onSelect({ kind: "lesson", id: l.id })}
                  onDuplicate={async () => { try { await duplicateLesson(l.id); toast.success("Duplicated"); refetchLessons(); } catch (e) { toast.error("Duplicate failed", { description: (e as Error).message }); } }}
                  onToggle={async () => { try { await toggleLessonVisibility(l.id, l.status === "published"); refetchLessons(); } catch (e) { toast.error("Update failed", { description: (e as Error).message }); } }}
                  onDelete={() => onDeleteRequest({ kind: "lesson", id: l.id, title: l.title })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <button className="text-xs text-primary hover:underline mt-2" onClick={addLesson}>+ Add lesson</button>
      </div>
    </li>
  );
}

function LessonNode({ lesson, selected, onSelect, onDuplicate, onToggle, onDelete }: {
  lesson: Lesson; selected: boolean; onSelect: () => void;
  onDuplicate: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 };
  return (
    <li ref={setNodeRef} style={style} className={`flex items-center gap-1 rounded px-2 py-1 text-sm ${selected ? "bg-muted" : "hover:bg-muted/50"}`}>
      <button {...attributes} {...listeners} className="text-foreground/40 cursor-grab"><GripVertical className="w-3 h-3" /></button>
      <button className="flex-1 text-left truncate" onClick={onSelect}>{lesson.title}</button>
      <StatusBadge status={lesson.status} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-6 w-6"><MoreVertical className="w-3 h-3" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDuplicate}><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={onToggle}>
            {lesson.status === "published" ? <><EyeOff className="w-4 h-4 mr-2" /> Hide</> : <><Eye className="w-4 h-4 mr-2" /> Publish</>}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={onDelete}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function CourseOverview({ course, onSaved }: { course: Course; onSaved: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-foreground/60">Select a module or lesson to edit its content, or use the wizard to create new courses.</p>
      <div className="mt-4 p-4 rounded bg-muted/40">
        <p className="font-medium mb-2">{course.title}</p>
        <p className="text-xs text-foreground/60">Status: {course.status} · Access: {course.access_type}</p>
      </div>
    </div>
  );
}

function useAutosave<T>(value: T, save: (v: T) => Promise<void>, delay = 700) {
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    setSaving("idle");
    const t = setTimeout(async () => {
      try { setSaving("saving"); await save(value); setSaving("saved"); }
      catch { setSaving("error"); }
    }, delay);
    return () => clearTimeout(t);
     
  }, [value]);
  return saving;
}

function ModuleEditor({ module, onSaved }: { module: Module; onSaved: () => void }) {
  const [form, setForm] = useState(module);
  useEffect(() => setForm(module), [module.id]);
  const status = useAutosave(form, async (v) => {
    if (v.id !== module.id) return;
    await updateModule(v.id, {
      title: v.title, description: v.description,
      release_type: v.release_type, release_after_days: v.release_after_days, release_at: v.release_at,
      access_plan_keys: v.access_plan_keys,
    });
    onSaved();
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Module settings</h2>
        <SaveStatus status={status} />
      </div>
      <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><Label>Description</Label><Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
    </div>
  );
}

function LessonEditor({ lesson, onSaved }: { lesson: Lesson; onSaved: () => void }) {
  const [form, setForm] = useState(lesson);
  useEffect(() => setForm(lesson), [lesson.id]);
  const status = useAutosave(form, async (v) => {
    if (v.id !== lesson.id) return;
    await updateLesson(v.id, {
      title: v.title, description: v.description, content_text: v.content_text,
      external_video_url: v.external_video_url, external_resource_url: v.external_resource_url,
      lesson_type: v.lesson_type, duration_seconds: v.duration_seconds,
      is_mandatory: v.is_mandatory, is_preview: v.is_preview,
      allow_comments: v.allow_comments, allow_download: v.allow_download,
    });
    onSaved();
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Lesson editor</h2>
        <SaveStatus status={status} />
      </div>
      <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={form.lesson_type} onValueChange={(v) => setForm({ ...form, lesson_type: v as Lesson["lesson_type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["video", "text", "audio", "pdf", "live", "external_link"] as Lesson["lesson_type"][]).map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Duration (seconds)</Label>
          <Input type="number" value={form.duration_seconds ?? ""} onChange={(e) => setForm({ ...form, duration_seconds: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
      <div><Label>Video URL (YouTube / Vimeo / Dropbox / MP4)</Label><Input value={form.external_video_url ?? ""} onChange={(e) => setForm({ ...form, external_video_url: e.target.value || null })} placeholder="https://…" /></div>
      <div><Label>Resource / download URL</Label><Input value={form.external_resource_url ?? ""} onChange={(e) => setForm({ ...form, external_resource_url: e.target.value || null })} placeholder="https://…" /></div>
      <div><Label>Description</Label><Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Content (text)</Label><Textarea rows={6} value={form.content_text ?? ""} onChange={(e) => setForm({ ...form, content_text: e.target.value })} /></div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><Switch checked={form.is_mandatory} onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })} /> Mandatory</label>
        <label className="flex items-center gap-2"><Switch checked={form.is_preview} onCheckedChange={(v) => setForm({ ...form, is_preview: v })} /> Free preview</label>
        <label className="flex items-center gap-2"><Switch checked={form.allow_comments} onCheckedChange={(v) => setForm({ ...form, allow_comments: v })} /> Allow comments</label>
        <label className="flex items-center gap-2"><Switch checked={form.allow_download} onCheckedChange={(v) => setForm({ ...form, allow_download: v })} /> Allow download</label>
      </div>
    </div>
  );
}

function SaveStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  const map = { idle: "Ready", saving: "Saving…", saved: "Saved", error: "Save failed" };
  const cls = { idle: "text-foreground/50", saving: "text-amber-600", saved: "text-emerald-600", error: "text-destructive" }[status];
  return <span className={`text-xs ${cls} inline-flex items-center gap-1`}><Save className="w-3 h-3" /> {map[status]}</span>;
}

function ViewAsMemberButton({ courseId }: { courseId: number }) {
  const PLANS: PreviewPlan[] = ["none", "free", "monthly_member", "annual_member", "individual_course"];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline"><Eye className="w-4 h-4 mr-2" /> View as member</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PLANS.map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => { setPreviewPlan(p); window.open(`/courses/${courseId}`, "_blank", "noopener"); }}
          >
            {PREVIEW_PLAN_LABELS[p]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}