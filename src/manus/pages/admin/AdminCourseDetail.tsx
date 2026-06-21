import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Plus, Trash2, Upload } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AdminShell from "@/manus/components/admin/AdminShell";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import VideoPreview from "@/manus/components/admin/VideoPreview";
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  getCourse,
  listLessons,
  listModules,
  reorderRecords,
  slugify,
  statusTransition,
  swapSortOrder,
  updateCourse,
  updateLesson,
  updateModule,
  uploadCoverImage,
  type ContentStatus,
  type Lesson,
  type Module,
} from "@/manus/lib/admin-content";
import { supabase } from "@/integrations/supabase/client";

/* ============================================================
 * Inline auto-save text input / textarea
 * ============================================================ */
function AutoSaveInput({
  value,
  onSave,
  placeholder,
  className = "",
  multiline = false,
  rows = 2,
}: {
  value: string | null | undefined;
  onSave: (v: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const [val, setVal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const initial = useRef(value ?? "");
  useEffect(() => {
    setVal(value ?? "");
    initial.current = value ?? "";
  }, [value]);

  const commit = async () => {
    if (val === initial.current) return;
    setSaving(true);
    try {
      await onSave(val);
      initial.current = val;
    } catch (e: any) {
      toast.error(e.message ?? String(e));
      setVal(initial.current);
    } finally {
      setSaving(false);
    }
  };

  const props = {
    value: val,
    placeholder,
    onChange: (e: any) => setVal(e.target.value),
    onBlur: commit,
    className: `${className} ${saving ? "opacity-60" : ""}`,
  };

  return multiline ? <Textarea {...props} rows={rows} /> : <Input {...props} />;
}

/* ============================================================
 * Lesson row — title, video URL + live preview, status, reorder, delete
 * ============================================================ */
function LessonRow({
  lesson,
  index,
  count,
  onMove,
  onDelete,
  onChanged,
}: {
  lesson: Lesson;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => Promise<void>;
  onDelete: () => Promise<void>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(lesson.external_video_url ?? "");
  useEffect(() => setUrl(lesson.external_video_url ?? ""), [lesson.external_video_url]);

  const save = async (patch: Parameters<typeof updateLesson>[1]) => {
    await updateLesson(lesson.id, patch);
    onChanged();
  };

  const toggleStatus = async () => {
    const next: ContentStatus = lesson.status === "published" ? "draft" : "published";
    await updateLesson(lesson.id, statusTransition(next));
    onChanged();
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex items-center gap-2 p-3">
        <div className="flex flex-col">
          <button className="p-0.5 disabled:opacity-20" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUp className="w-3 h-3" />
          </button>
          <button className="p-0.5 disabled:opacity-20" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
        <span className="text-xs font-mono text-foreground/50 w-6">{lesson.sort_order}</span>
        <button onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-left flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <span className="font-medium truncate">{lesson.title || "Untitled lesson"}</span>
          {!url && <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">no link</span>}
        </button>
        <button onClick={toggleStatus} title="Toggle status" className="shrink-0">
          <StatusBadge status={lesson.status} />
        </button>
        <button onClick={onDelete} className="text-red-600 hover:text-red-700 p-1" aria-label="Delete lesson">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="border-t p-4 grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <AutoSaveInput value={lesson.title} onSave={(v) => save({ title: v })} />
            </div>
            <div>
              <Label className="text-xs">Video URL (YouTube, Vimeo, MP4…)</Label>
              <AutoSaveInput
                value={lesson.external_video_url}
                onSave={(v) => save({ external_video_url: v.trim() || null })}
                placeholder="https://youtube.com/watch?v=…"
              />
            </div>
            <div>
              <Label className="text-xs">Resource URL (optional)</Label>
              <AutoSaveInput
                value={lesson.external_resource_url}
                onSave={(v) => save({ external_resource_url: v.trim() || null })}
                placeholder="https://…"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <AutoSaveInput
                value={lesson.description}
                multiline
                rows={3}
                onSave={(v) => save({ description: v.trim() || null })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Preview</Label>
            <VideoPreview url={lesson.external_video_url} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Module section with its lessons
 * ============================================================ */
function ModuleSection({
  module,
  index,
  count,
  onMove,
  onChanged,
  onDeleted,
}: {
  module: Module;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => Promise<void>;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { data: lessons = [], refetch } = useQuery({
    queryKey: ["admin", "module-lessons", module.id],
    queryFn: () => listLessons(module.id),
  });

  const handleAdd = async () => {
    const nextOrder = (lessons[lessons.length - 1]?.sort_order ?? 0) + 1;
    try {
      await createLesson(module.id, nextOrder);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMoveLesson = async (i: number, dir: -1 | 1) => {
    const a = lessons[i];
    const b = lessons[i + dir];
    if (!a || !b) return;
    try {
      await swapSortOrder("lessons", a, b);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteLesson = async (id: number) => {
    if (!confirm("Delete this lesson?")) return;
    try {
      await deleteLesson(id);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleStatus = async () => {
    const next: ContentStatus = module.status === "published" ? "draft" : "published";
    await updateModule(module.id, statusTransition(next));
    onChanged();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <button className="p-0.5 disabled:opacity-20" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="w-3 h-3" />
          </button>
          <button className="p-0.5 disabled:opacity-20" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
        <div className="flex-1 grid sm:grid-cols-2 gap-3">
          <AutoSaveInput
            value={module.title}
            onSave={(v) => updateModule(module.id, { title: v }).then(onChanged)}
            placeholder="Module title"
            className="font-semibold"
          />
          <AutoSaveInput
            value={module.description}
            onSave={(v) => updateModule(module.id, { description: v.trim() || null }).then(onChanged)}
            placeholder="Module description"
          />
        </div>
        <button onClick={toggleStatus} title="Toggle status" className="shrink-0">
          <StatusBadge status={module.status} />
        </button>
        <button
          onClick={async () => {
            if (!confirm("Delete this module and all its lessons?")) return;
            try {
              await deleteModule(module.id);
              onDeleted();
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
          className="text-red-600 hover:text-red-700 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 pl-2 border-l-2 border-border/40 ml-2">
        {lessons.map((l, i) => (
          <LessonRow
            key={l.id}
            lesson={l}
            index={i}
            count={lessons.length}
            onMove={(dir) => handleMoveLesson(i, dir)}
            onDelete={() => handleDeleteLesson(l.id)}
            onChanged={() => {
              refetch();
              qc.invalidateQueries({ queryKey: ["admin", "module-lessons", module.id] });
            }}
          />
        ))}
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="w-3 h-3 mr-1" /> Add lesson
        </Button>
      </div>
    </Card>
  );
}

/* ============================================================
 * Course header card (cover image, title, slug, status)
 * ============================================================ */
function CourseHeader({
  course,
  onChanged,
}: {
  course: import("@/manus/lib/admin-content").Course;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadCoverImage(file, "courses");
      await updateCourse(course.id, { cover_image_path: url });
      onChanged();
      toast.success("Cover updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const cycleStatus = async (target: ContentStatus) => {
    await updateCourse(course.id, statusTransition(target));
    onChanged();
  };

  return (
    <Card className="p-5">
      <div className="grid md:grid-cols-[200px_1fr] gap-5">
        <div className="space-y-2">
          <div className="aspect-video bg-muted rounded overflow-hidden border">
            {course.cover_image_path ? (
              <img src={course.cover_image_path} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.opacity = "0.3")} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-foreground/40">No cover</div>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> {uploading ? "Uploading…" : "Upload cover"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start">
            <AutoSaveInput
              value={course.title}
              onSave={(v) => updateCourse(course.id, { title: v }).then(onChanged)}
              className="text-lg font-semibold"
              placeholder="Course title"
            />
            <div className="flex items-center gap-2">
              <StatusBadge status={course.status} />
              {course.status !== "published" ? (
                <Button size="sm" onClick={() => cycleStatus("published")}>Publish</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => cycleStatus("draft")}>Unpublish</Button>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Slug</Label>
              <AutoSaveInput
                value={course.slug}
                onSave={(v) => updateCourse(course.id, { slug: v.trim() || slugify(course.title) }).then(onChanged)}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Sort order</Label>
              <AutoSaveInput
                value={String(course.sort_order)}
                onSave={(v) => updateCourse(course.id, { sort_order: Number(v) || 0 }).then(onChanged)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Subtitle</Label>
            <AutoSaveInput
              value={course.subtitle}
              onSave={(v) => updateCourse(course.id, { subtitle: v.trim() || null }).then(onChanged)}
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <AutoSaveInput
              value={course.description}
              multiline
              rows={3}
              onSave={(v) => updateCourse(course.id, { description: v.trim() || null }).then(onChanged)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
 * Page — handles both /new and existing /admin/courses/:id
 * ============================================================ */
export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const courseId = isNew ? null : Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: course, refetch: refetchCourse } = useQuery({
    queryKey: ["admin", "course", courseId],
    queryFn: () => getCourse(courseId!),
    enabled: !!courseId,
  });

  const { data: modules = [], refetch: refetchModules } = useQuery({
    queryKey: ["admin", "course", courseId, "modules"],
    queryFn: () => listModules(courseId!),
    enabled: !!courseId,
  });

  // ----- New course form -----
  const [newForm, setNewForm] = useState({ title: "", slug: "" });
  const createCourse = useMutation({
    mutationFn: async () => {
      const title = newForm.title.trim();
      if (!title) throw new Error("Title is required");
      const slug = newForm.slug.trim() || slugify(title);
      const { data, error } = await supabase
        .from("courses")
        .insert({ title, slug, status: "draft" as const })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Course created");
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      navigate(`/admin/courses/${data.id}`, { replace: true });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAddModule = async () => {
    if (!courseId) return;
    const nextOrder = (modules[modules.length - 1]?.sort_order ?? 0) + 1;
    try {
      await createModule(courseId, nextOrder);
      await refetchModules();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMoveModule = async (i: number, dir: -1 | 1) => {
    const a = modules[i];
    const b = modules[i + dir];
    if (!a || !b) return;
    try {
      await swapSortOrder("course_modules", a, b);
      await refetchModules();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isNew) {
    return (
      <AdminShell title="New course" crumbs={[{ label: "Courses", to: "/admin/courses" }, { label: "New" }]}>
        <Card className="p-6 max-w-xl space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={newForm.title} onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label>Slug</Label>
            <div className="flex gap-2">
              <Input
                value={newForm.slug}
                onChange={(e) => setNewForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder={slugify(newForm.title)}
                className="font-mono text-sm"
              />
              <Button type="button" variant="outline" onClick={() => setNewForm((f) => ({ ...f, slug: slugify(f.title) }))}>Auto</Button>
            </div>
          </div>
          <Button onClick={() => createCourse.mutate()} disabled={createCourse.isPending}>
            Create course
          </Button>
        </Card>
      </AdminShell>
    );
  }

  if (!course) {
    return (
      <AdminShell title="Loading…" crumbs={[{ label: "Courses", to: "/admin/courses" }]}>
        <p className="text-sm text-foreground/60">Loading course…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={course.title || "Course"}
      crumbs={[{ label: "Courses", to: "/admin/courses" }, { label: course.title || "—" }]}
    >
      <div className="space-y-5">
        <CourseHeader course={course} onChanged={() => refetchCourse()} />

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Modules &amp; lessons</h2>
          <Button onClick={handleAddModule}><Plus className="w-4 h-4 mr-1" /> Add module</Button>
        </div>

        {modules.length === 0 && (
          <Card className="p-6 text-sm text-foreground/60 text-center">
            No modules yet. Click <strong>Add module</strong> to start.
          </Card>
        )}

        <div className="space-y-4">
          {modules.map((m, i) => (
            <ModuleSection
              key={m.id}
              module={m}
              index={i}
              count={modules.length}
              onMove={(dir) => handleMoveModule(i, dir)}
              onChanged={() => refetchModules()}
              onDeleted={() => refetchModules()}
            />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
