import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, GripVertical, Plus, Trash2, Upload } from "lucide-react";
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
import LessonVideoUpload from "@/manus/components/admin/LessonVideoUpload";
import PublishChecklist, { canPublish, type ChecklistItem } from "@/manus/components/admin/PublishChecklist";
import AdminQuizEditor from "@/manus/components/admin/AdminQuizEditor";
import CertificatePreview from "@/manus/components/learning/CertificatePreview";
import { parseVideoUrl, stripQueryForDisplay } from "@/manus/lib/video-url";

import {
  createLesson,
  createModule,
  archiveLesson,
  archiveModule,
  getCourse,
  isPlaceholderVideo,
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
  PLAN_KEYS,
  STATUSES,
  type ContentStatus,
  type Lesson,
  type Module,
} from "@/manus/lib/admin-content";
import { supabase } from "@/integrations/supabase/client";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
    } catch (e: unknown) {
      toast.error(errorMessage(e));
      setVal(initial.current);
    } finally {
      setSaving(false);
    }
  };

  const props = {
    value: val,
    placeholder,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(e.target.value),
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
  moduleCoverImage,
  onDelete,
  onChanged,
}: {
  lesson: Lesson;
  moduleCoverImage?: string | null;
  onDelete: () => Promise<void>;
  onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(lesson.external_video_url ?? "");
  useEffect(() => setUrl(lesson.external_video_url ?? ""), [lesson.external_video_url]);

  const memberPreviewHref = `/modules/${lesson.module_id}#lesson-${lesson.id}`;

  const quizScopeQuery = useQuery({
    queryKey: ["admin", "lesson-preview", lesson.id, "quiz-scope"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title,status,lesson_id")
        .eq("lesson_id", lesson.id)
        .order("id");
      if (error) throw error;
      return (data ?? []) as Array<{ id: number; title: string; status: string; lesson_id: number | null }>;
    },
  });

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
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-card">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="p-1 text-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-foreground/50 w-6">{lesson.sort_order}</span>
        <button onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-left flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <span className="font-medium truncate">{lesson.title || "Untitled lesson"}</span>
          {!url && <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">no link</span>}
        </button>
        <button onClick={toggleStatus} title="Toggle status" className="shrink-0">
          <StatusBadge status={lesson.status} />
        </button>
        <a
          href={memberPreviewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-border bg-background px-2 text-xs hover:bg-muted"
          title="Lesson preview"
        >
          <Eye className="w-3 h-3" /> Preview
        </a>
        <select
          value={lesson.status}
          onChange={(e) => save(statusTransition(e.currentTarget.value as ContentStatus))}
          className="h-8 rounded border bg-background px-2 text-xs"
          aria-label="Lesson status"
        >
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button onClick={onDelete} className="text-red-600 hover:text-red-700 p-1" aria-label="Archive lesson" title="Archive lesson">
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
              <Label className="text-xs">Content text</Label>
              <AutoSaveInput value={lesson.content_text} multiline rows={4} onSave={(v) => save({ content_text: v.trim() || null })} />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Duration seconds</Label>
                <AutoSaveInput value={String(lesson.duration_seconds ?? "")} onSave={(v) => save({ duration_seconds: v.trim() ? Number(v) : null })} />
              </div>
              <div>
                <Label className="text-xs">Sort order</Label>
                <AutoSaveInput value={String(lesson.sort_order)} onSave={(v) => save({ sort_order: Number(v) || 0 })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground/70">
              <input type="checkbox" checked={Boolean(lesson.is_preview)} onChange={(e) => save({ is_preview: e.currentTarget.checked })} />
              Preview lesson
            </label>
          </div>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-foreground/70">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">Lesson preview</span>
                <a href={memberPreviewHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">
                  <Eye className="w-3 h-3" /> Open player
                </a>
              </div>
              <ul className="space-y-1">
                <li>Thumbnail: {moduleCoverImage ? "module thumbnail configured" : "module thumbnail missing"}</li>
                <li>Video link: {lesson.external_video_url ? "configured" : "missing"}</li>
                <li>Published: {lesson.status === "published" ? "yes" : "draft preview only"}</li>
                <li>
                  Quiz scope: {quizScopeQuery.isLoading
                    ? "checking…"
                    : (quizScopeQuery.data ?? []).length > 0
                      ? (quizScopeQuery.data ?? []).map((q) => `${q.title || `Quiz #${q.id}`} (${q.status})`).join(", ")
                      : "no quiz scoped to this lesson"}
                </li>
              </ul>
              {moduleCoverImage ? (
                <div className="mt-3 aspect-video overflow-hidden rounded border bg-muted">
                  <img src={moduleCoverImage} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
            </div>
            <div>
              <Label className="text-xs">Preview</Label>
              <VideoPreview url={lesson.external_video_url} />
            </div>
            <LessonVideoUpload
              lessonId={lesson.id}
              value={lesson.external_video_url}
              onUploaded={(v) => save({ external_video_url: v })}
              onRemoved={() => save({ external_video_url: null })}
            />
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
  courseId,
  index,
  count,
  onMove,
  onChanged,
  onDeleted,
}: {
  module: Module;
  courseId: number;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => Promise<void>;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();

  // Invalidate every view that lists modules/lessons for this course.
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "module-lessons", module.id] });
    qc.invalidateQueries({ queryKey: ["admin", "course", courseId, "modules"] });
    qc.invalidateQueries({ queryKey: ["admin", "course", courseId, "all-lessons"] });
    qc.invalidateQueries({ queryKey: ["admin", "courses-tree"] });
  };

  const { data: lessons = [], refetch } = useQuery({
    queryKey: ["admin", "module-lessons", module.id],
    queryFn: () => listLessons(module.id),
  });

  // Local optimistic order — keeps the list snappy during drag.
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  useEffect(() => {
    setOrderedIds((prev) => {
      const next = lessons.map((l) => l.id);
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  }, [lessons]);
  const lessonById = new Map(lessons.map((l) => [l.id, l] as const));
  const orderedLessons = orderedIds.map((id) => lessonById.get(id)).filter(Boolean) as Lesson[];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as number);
    const newIndex = orderedIds.indexOf(over.id as number);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next); // optimistic
    try {
      await reorderRecords("lessons", next, lessonById);
      await refetch();
      invalidateAll();
    } catch (e: unknown) {
      toast.error(`Reorder failed: ${errorMessage(e)}`);
      setOrderedIds(lessons.map((l) => l.id)); // revert
    }
  };

  const handleAdd = async () => {
    const nextOrder = (lessons[lessons.length - 1]?.sort_order ?? 0) + 1;
    try {
      const created = await createLesson(module.id, nextOrder);
      await refetch();
      invalidateAll();
      toast.success(`Lesson "${created.title}" created`);
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  };

  const handleArchiveLesson = async (id: number) => {
    if (!confirm("Archive this lesson? It will be hidden from default lists but can be restored later by clearing archived_at and updating the status.")) return;
    try {
      await archiveLesson(id);
      await refetch();
      invalidateAll();
      toast.success("Archived");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  };

  const saveModule = async (patch: Parameters<typeof updateModule>[1]) => {
    try {
      await updateModule(module.id, patch);
      onChanged();
      invalidateAll();
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  };

  const toggleStatus = async () => {
    const next: ContentStatus = module.status === "published" ? "draft" : "published";
    await saveModule(statusTransition(next));
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
            onSave={(v) => saveModule({ title: v })}
            placeholder="Module title"
            className="font-semibold"
          />
          <AutoSaveInput
            value={module.description}
            onSave={(v) => saveModule({ description: v.trim() || null })}
            placeholder="Module description"
          />
          <AutoSaveInput
            value={module.cover_image_path}
            onSave={(v) => saveModule({ cover_image_path: v.trim() || null })}
            placeholder="Module cover image path"
          />
          <AutoSaveInput
            value={String(module.sort_order)}
            onSave={(v) => saveModule({ sort_order: Number(v) || 0 })}
            placeholder="Module sort order"
          />
        </div>
        <button onClick={toggleStatus} title="Toggle status" className="shrink-0">
          <StatusBadge status={module.status} />
        </button>
        <select
          value={module.status}
          onChange={(e) => saveModule(statusTransition(e.currentTarget.value as ContentStatus))}
          className="h-8 rounded border bg-background px-2 text-xs"
          aria-label="Module status"
        >
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button
          onClick={async () => {
            if (!confirm("Archive this module? It will be hidden from default lists but can be restored later. Lessons under it will NOT be archived automatically.")) return;
            try {
              await archiveModule(module.id);
              onDeleted();
              invalidateAll();
              toast.success("Archived");
            } catch (e: unknown) {
              toast.error(errorMessage(e));
            }
          }}
          className="text-red-600 hover:text-red-700 p-1"
          aria-label="Archive module"
          title="Archive module"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 pl-2 border-l-2 border-border/40 ml-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedLessons.map((l) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  moduleCoverImage={module.cover_image_path}
                  onDelete={() => handleArchiveLesson(l.id)}
                  onChanged={() => {
                    void refetch();
                    invalidateAll();
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
    } catch (e: unknown) {
      toast.error(errorMessage(e));
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
              <select
                value={course.status}
                onChange={(e) => cycleStatus(e.currentTarget.value as ContentStatus)}
                className="h-9 rounded border bg-background px-2 text-xs"
                aria-label="Course status"
              >
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
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
            <Label className="text-xs">Cover image path</Label>
            <AutoSaveInput
              value={course.cover_image_path}
              onSave={(v) => updateCourse(course.id, { cover_image_path: v.trim() || null }).then(onChanged)}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Access plan keys</Label>
            <div className="flex flex-wrap gap-3 pt-2">
              {PLAN_KEYS.map((key) => {
                const checked = (course.access_plan_keys ?? []).includes(key);
                return (
                  <label key={key} className="flex items-center gap-2 text-xs text-foreground/70">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = course.access_plan_keys ?? [];
                        const next = e.currentTarget.checked
                          ? Array.from(new Set([...current, key]))
                          : current.filter((item) => item !== key);
                        void updateCourse(course.id, { access_plan_keys: next }).then(onChanged);
                      }}
                    />
                    {key}
                  </label>
                );
              })}
            </div>
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

  const {
    data: course,
    refetch: refetchCourse,
    isLoading: courseLoading,
    isError: courseIsError,
    error: courseError,
  } = useQuery({
    queryKey: ["admin", "course", courseId],
    queryFn: () => getCourse(courseId!),
    enabled: !!courseId,
    retry: false,
  });

  const { data: modules = [], refetch: refetchModules } = useQuery({
    queryKey: ["admin", "course", courseId, "modules"],
    queryFn: () => listModules(courseId!),
    enabled: !!courseId,
  });

  // All lessons for this course — used by the publish checklist.
  const { data: allLessons = [] } = useQuery({
    queryKey: ["admin", "course", courseId, "all-lessons"],
    queryFn: async () => {
      const moduleIds = modules.map((m) => m.id);
      if (!moduleIds.length) return [] as Lesson[];
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .in("module_id", moduleIds);
      if (error) throw error;
      return (data ?? []) as Lesson[];
    },
    enabled: !!courseId && modules.length > 0,
  });

  const { data: scopedQuizzes = [] } = useQuery({
    queryKey: ["admin", "course", courseId, "lesson-preview-quizzes", allLessons.map((l) => l.id).join(",")],
    enabled: !!courseId && allLessons.length > 0,
    queryFn: async () => {
      const lessonIds = allLessons.map((lesson) => lesson.id);
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title,status,lesson_id")
        .in("lesson_id", lessonIds)
        .order("id");
      if (error) throw error;
      return (data ?? []) as Array<{ id: number; title: string; status: string; lesson_id: number | null }>;
    },
  });

  const lessonPreviewRows = useMemo(() => {
    const moduleById = new Map(modules.map((module) => [module.id, module] as const));
    const quizzesByLesson = new Map<number, Array<{ id: number; title: string; status: string }>>();
    for (const quiz of scopedQuizzes) {
      if (!quiz.lesson_id) continue;
      const list = quizzesByLesson.get(quiz.lesson_id) ?? [];
      list.push({ id: quiz.id, title: quiz.title, status: quiz.status });
      quizzesByLesson.set(quiz.lesson_id, list);
    }
    return allLessons
      .slice()
      .sort((a, b) => {
        const ma = moduleById.get(a.module_id)?.sort_order ?? 0;
        const mb = moduleById.get(b.module_id)?.sort_order ?? 0;
        return ma - mb || a.sort_order - b.sort_order;
      })
      .map((lesson) => ({
        lesson,
        module: moduleById.get(lesson.module_id) ?? null,
        quizzes: quizzesByLesson.get(lesson.id) ?? [],
      }));
  }, [allLessons, modules, scopedQuizzes]);

  const checklist: ChecklistItem[] = course
    ? [
        { label: "Has title", ok: Boolean(course.title?.trim()) },
        { label: "Has slug", ok: Boolean(course.slug?.trim()) },
        { label: "Has description", ok: Boolean(course.description?.trim()) },
        { label: "Has cover image", ok: Boolean(course.cover_image_path) },
        { label: "At least one module", ok: modules.length > 0 },
        { label: "All modules have lessons", ok: modules.every((m) => allLessons.some((l) => l.module_id === m.id)) },
        { label: "All modules are published", ok: modules.length > 0 && modules.every((m) => m.status === "published") },
        {
          label: "All lessons have a video (URL or upload)",
          ok:
            allLessons.length > 0 &&
            allLessons.every(
              (l) => l.external_video_url && !isPlaceholderVideo(l.external_video_url),
            ),
        },
        {
          label: "All video lessons are published",
          ok:
            allLessons.length > 0 &&
            allLessons
              .filter((l) => l.external_video_url && !isPlaceholderVideo(l.external_video_url))
              .every((l) => l.status === "published"),
        },
      ]
    : [];

  // ----- New course form -----
  const [newForm, setNewForm] = useState({
    title: "",
    slug: "",
    subtitle: "",
    description: "",
    cover_image_path: "" as string | null | "",
  });
  const [newCoverUploading, setNewCoverUploading] = useState(false);
  const newCoverRef = useRef<HTMLInputElement>(null);

  const uploadNewCover = async (file: File) => {
    setNewCoverUploading(true);
    try {
      const url = await uploadCoverImage(file, "courses");
      setNewForm((f) => ({ ...f, cover_image_path: url }));
      toast.success("Cover uploaded");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setNewCoverUploading(false);
    }
  };

  const createCourse = useMutation({
    mutationFn: async () => {
      const title = newForm.title.trim();
      if (!title) throw new Error("Title is required");
      const slug = newForm.slug.trim() || slugify(title);
      const { data, error } = await supabase
        .from("courses")
        .insert({
          title,
          slug,
          subtitle: newForm.subtitle.trim() || null,
          description: newForm.description.trim() || null,
          cover_image_path: newForm.cover_image_path || null,
          status: "draft" as const,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Course created — add modules & lessons below");
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      qc.invalidateQueries({ queryKey: ["admin", "courses-tree"] });
      navigate(`/admin/courses/${data.id}`, { replace: true });
    },
    onError: (e: unknown) => toast.error(errorMessage(e)),
  });

  const invalidateCourse = () => {
    qc.invalidateQueries({ queryKey: ["admin", "course", courseId] });
    qc.invalidateQueries({ queryKey: ["admin", "course", courseId, "modules"] });
    qc.invalidateQueries({ queryKey: ["admin", "course", courseId, "all-lessons"] });
    qc.invalidateQueries({ queryKey: ["admin", "courses-tree"] });
  };

  const handleAddModule = async () => {
    if (!courseId) return;
    const nextOrder = (modules[modules.length - 1]?.sort_order ?? 0) + 1;
    try {
      const created = await createModule(courseId, nextOrder);
      await refetchModules();
      invalidateCourse();
      toast.success(`Module "${created.title}" created`);
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  };

  const handleMoveModule = async (i: number, dir: -1 | 1) => {
    const a = modules[i];
    const b = modules[i + dir];
    if (!a || !b) return;
    try {
      await swapSortOrder("course_modules", a, b);
      await refetchModules();
      invalidateCourse();
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  };

  const publishReadyContent = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("Course is not ready yet");
      const now = new Date().toISOString();
      const moduleIds = modules.map((m) => m.id);
      const readyLessonIds = allLessons
        .filter((l) => l.external_video_url?.trim() && !isPlaceholderVideo(l.external_video_url))
        .map((l) => l.id);

      const { error: courseError } = await supabase
        .from("courses")
        .update({ status: "published", published_at: now, archived_at: null })
        .eq("id", courseId);
      if (courseError) throw courseError;

      if (moduleIds.length > 0) {
        const { error: modulesError } = await supabase
          .from("course_modules")
          .update({ status: "published", published_at: now, archived_at: null })
          .in("id", moduleIds);
        if (modulesError) throw modulesError;
      }

      if (readyLessonIds.length > 0) {
        const { error: lessonsError } = await supabase
          .from("lessons")
          .update({ status: "published", published_at: now, archived_at: null })
          .in("id", readyLessonIds);
        if (lessonsError) throw lessonsError;
      }

      return {
        modules: moduleIds.length,
        lessons: readyLessonIds.length,
        skippedLessons: Math.max(0, allLessons.length - readyLessonIds.length),
      };
    },
    onSuccess: (result) => {
      toast.success(
        `Published course, ${result.modules} module${result.modules === 1 ? "" : "s"}, and ${result.lessons} video lesson${result.lessons === 1 ? "" : "s"}.`,
      );
      if (result.skippedLessons > 0) {
        toast.warning(`${result.skippedLessons} lesson${result.skippedLessons === 1 ? "" : "s"} stayed draft because no video link is configured.`);
      }
      void refetchCourse();
      void refetchModules();
      invalidateCourse();
    },
    onError: (e: unknown) => toast.error(errorMessage(e)),
  });



  if (isNew) {
    return (
      <AdminShell title="New course" crumbs={[{ label: "Courses", to: "/admin/courses" }, { label: "New" }]}>
        <Card className="p-6 max-w-2xl space-y-4">
          <p className="text-xs text-foreground/60">
            Create the course first. After it's saved you'll add modules, lessons,
            video links, thumbnails and quizzes — same editor used by all existing courses.
          </p>
          <div>
            <Label>Title *</Label>
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
          <div>
            <Label>Subtitle</Label>
            <Input value={newForm.subtitle} onChange={(e) => setNewForm((f) => ({ ...f, subtitle: e.target.value }))} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={newForm.description} onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label>Cover thumbnail</Label>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-32 aspect-video bg-muted rounded overflow-hidden border flex items-center justify-center text-xs text-foreground/40">
                {newForm.cover_image_path
                  ? <img src={newForm.cover_image_path} alt="" className="w-full h-full object-cover" />
                  : "No cover"}
              </div>
              <Button type="button" variant="outline" size="sm" disabled={newCoverUploading} onClick={() => newCoverRef.current?.click()}>
                <Upload className="w-3 h-3 mr-1" /> {newCoverUploading ? "Uploading…" : "Upload cover"}
              </Button>
              <input
                ref={newCoverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadNewCover(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <Button onClick={() => createCourse.mutate()} disabled={createCourse.isPending || !newForm.title.trim()}>
            {createCourse.isPending ? "Creating…" : "Create course & continue"}
          </Button>
        </Card>
      </AdminShell>
    );
  }

  if (courseIsError) {
    const err = courseError as { message?: string; code?: string; hint?: string; details?: string } | null;
    return (
      <AdminShell title="Unable to load course" crumbs={[{ label: "Courses", to: "/admin/courses" }]}>
        <Card className="p-6 max-w-2xl space-y-3 border-destructive/40">
          <p className="text-sm font-semibold text-destructive">Failed to load course #{courseId}.</p>
          <p className="text-xs text-foreground/70">{err?.message ?? "Unknown error"}</p>
          {err?.code && <p className="text-xs font-mono">code: {err.code}</p>}
          {err?.hint && <p className="text-xs font-mono">hint: {err.hint}</p>}
          {err?.details && <p className="text-xs font-mono">details: {err.details}</p>}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => refetchCourse()}>Retry</Button>
            <Button variant="outline" onClick={() => navigate("/admin/courses")}>Back to list</Button>
          </div>
        </Card>
      </AdminShell>
    );
  }

  if (!course || courseLoading) {
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
        <CourseHeader course={course} onChanged={() => { void refetchCourse(); invalidateCourse(); }} />

        {course && (
          <div className="grid md:grid-cols-[1fr_320px] gap-4 items-start">
            <div />
            <PublishChecklist items={checklist} />
          </div>
        )}
        {course && course.status !== "published" && !canPublish(checklist) && (
          <Card className="p-3 text-xs text-amber-700 border-amber-200 bg-amber-50/50">
            This course cannot be published yet — complete the checklist above.
          </Card>
        )}

        {course && (
          <Card className="flex flex-col gap-3 p-4 text-xs text-foreground/70 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Member visibility</p>
              <p>
                Member pages only show published courses, published modules and published lessons. Use Lesson preview first, then publish all ready video lessons.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild type="button" variant="outline">
                <a href="#lesson-preview"><Eye className="mr-1 h-3.5 w-3.5" /> Lesson preview</a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => publishReadyContent.mutate()}
                disabled={publishReadyContent.isPending || modules.length === 0 || allLessons.length === 0}
              >
                {publishReadyContent.isPending ? "Publishing…" : "Publish ready course content"}
              </Button>
            </div>
          </Card>
        )}

        <LessonPreviewPanel rows={lessonPreviewRows} />

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
              courseId={courseId!}
              index={i}
              count={modules.length}
              onMove={(dir) => handleMoveModule(i, dir)}
              onChanged={() => {
                void refetchModules();
                invalidateCourse();
              }}
              onDeleted={() => {
                void refetchModules();
                invalidateCourse();
              }}
            />
          ))}

        </div>

        {courseId && <AdminQuizEditor courseId={courseId} />}

        {courseId && <CertificatePreviewPanel courseTitle={course?.title ?? "This course"} />}
      </div>

    </AdminShell>
  );
}

function CertificatePreviewPanel({ courseTitle }: { courseTitle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Certificate</h2>
          <p className="text-xs text-foreground/60">
            Preview the certificate students will receive. Never inserts a row.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs underline text-primary"
        >
          {open ? "Hide preview" : "Preview certificate"}
        </button>
      </div>
      {open && <CertificatePreview courseTitle={courseTitle} />}
    </Card>
  );
}
