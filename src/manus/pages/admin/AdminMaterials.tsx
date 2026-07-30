import { useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  FileText,
  Gift,
  Layers,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  createMaterialLink,
  deleteMaterial,
  formatBytes,
  getMaterialUrl,
  listAllMaterials,
  reassignMaterial,
  updateMaterial,
  uploadMaterialFile,
  type MaterialKind,
  type MaterialScope,
  type SupportMaterial,
} from "@/manus/lib/support-materials";

type CourseRow = { id: number; title: string };
type ModuleRow = { id: number; course_id: number; title: string };
type LessonRow = { id: number; module_id: number; title: string };
type Catalog = { courses: CourseRow[]; modules: ModuleRow[]; lessons: LessonRow[] };

const KINDS: { value: MaterialKind; label: string; hint: string }[] = [
  { value: "bonus", label: "Bonus", hint: "Platform bonus — released to all members when active" },
  { value: "course", label: "Course", hint: "Attached to an entire course" },
  { value: "module", label: "Module", hint: "Attached to one module" },
  { value: "lesson", label: "Lesson", hint: "Attached to one lesson" },
];

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

function useCatalog() {
  return useQuery({
    queryKey: ["admin", "materials", "catalog"],
    queryFn: async (): Promise<Catalog> => {
      const [courses, modules, lessons] = await Promise.all([
        supabase.from("courses").select("id,title").is("archived_at", null).order("sort_order"),
        supabase.from("course_modules").select("id,course_id,title").is("archived_at", null).order("sort_order"),
        supabase.from("lessons").select("id,module_id,title").is("archived_at", null).order("sort_order"),
      ]);
      if (courses.error) throw courses.error;
      if (modules.error) throw modules.error;
      if (lessons.error) throw lessons.error;
      return {
        courses: (courses.data ?? []) as CourseRow[],
        modules: (modules.data ?? []) as ModuleRow[],
        lessons: (lessons.data ?? []) as LessonRow[],
      };
    },
  });
}

function PickerSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function buildScope(
  kind: MaterialKind,
  courseId: string,
  moduleId: string,
  lessonId: string,
): MaterialScope | null {
  if (kind === "bonus") return { bonus: true };
  if (kind === "course") return courseId ? { courseId: Number(courseId) } : null;
  if (kind === "module") return moduleId ? { moduleId: Number(moduleId) } : null;
  return lessonId ? { lessonId: Number(lessonId) } : null;
}

function TargetPicker({
  kind,
  setKind,
  courseId,
  setCourseId,
  moduleId,
  setModuleId,
  lessonId,
  setLessonId,
  catalog,
}: {
  kind: MaterialKind;
  setKind: (k: MaterialKind) => void;
  courseId: string;
  setCourseId: (v: string) => void;
  moduleId: string;
  setModuleId: (v: string) => void;
  lessonId: string;
  setLessonId: (v: string) => void;
  catalog: Catalog;
}) {
  const modules = catalog.modules.filter((m) => String(m.course_id) === courseId);
  const lessons = catalog.lessons.filter((l) => String(l.module_id) === moduleId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            title={k.hint}
            onClick={() => {
              setKind(k.value);
              if (k.value === "bonus") {
                setCourseId("");
                setModuleId("");
                setLessonId("");
              }
            }}
            className={`min-h-[40px] rounded-md border px-3 text-sm transition-colors ${
              kind === k.value ? "border-primary bg-primary/10 font-semibold" : "border-border text-foreground/70"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind !== "bonus" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-[11px]">Course</Label>
            <PickerSelect
              ariaLabel="Course"
              placeholder="Select course…"
              value={courseId}
              onChange={(v) => {
                setCourseId(v);
                setModuleId("");
                setLessonId("");
              }}
              options={catalog.courses.map((c) => ({ value: String(c.id), label: c.title }))}
            />
          </div>
          {kind !== "course" ? (
            <div>
              <Label className="text-[11px]">Module</Label>
              <PickerSelect
                ariaLabel="Module"
                placeholder="Select module…"
                value={moduleId}
                onChange={(v) => {
                  setModuleId(v);
                  setLessonId("");
                }}
                options={modules.map((m) => ({ value: String(m.id), label: m.title }))}
              />
            </div>
          ) : null}
          {kind === "lesson" ? (
            <div>
              <Label className="text-[11px]">Lesson</Label>
              <PickerSelect
                ariaLabel="Lesson"
                placeholder="Select lesson…"
                value={lessonId}
                onChange={setLessonId}
                options={lessons.map((l) => ({ value: String(l.id), label: l.title }))}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-2 text-xs text-foreground/60">
          Bonus materials are not tied to a course. They become visible to every member once
          <span className="font-medium"> Released</span> is on.
        </p>
      )}
    </div>
  );
}

export default function AdminMaterials() {
  const qc = useQueryClient();
  const { data: catalog } = useCatalog();
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["admin", "materials", "all"],
    queryFn: listAllMaterials,
  });

  const [kind, setKind] = useState<MaterialKind>("bonus");
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [mode, setMode] = useState<"file" | "link">("file");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<"all" | MaterialKind>("all");
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const cat: Catalog = catalog ?? { courses: [], modules: [], lessons: [] };
  const scope = buildScope(kind, courseId, moduleId, lessonId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "materials", "all"] });
    qc.invalidateQueries({ queryKey: ["admin", "support-materials"] });
    qc.invalidateQueries({ queryKey: ["support-materials"] });
  };

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!scope) throw new Error("Choose where this material belongs first.");
      for (const file of files) {
        await uploadMaterialFile({ scope, file, onProgress: setProgress });
      }
    },
    onSuccess: () => {
      toast.success("Material uploaded");
      setProgress(null);
      invalidate();
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setProgress(null);
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!scope) throw new Error("Choose where this material belongs first.");
      await createMaterialLink({ scope, url: linkUrl, title: linkTitle || linkUrl });
    },
    onSuccess: () => {
      toast.success("Link added");
      setLinkTitle("");
      setLinkUrl("");
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const labelFor = useMemo(() => {
    const courses = new Map(cat.courses.map((c) => [c.id, c.title]));
    const modules = new Map(cat.modules.map((m) => [m.id, m]));
    const lessons = new Map(cat.lessons.map((l) => [l.id, l]));
    return (m: SupportMaterial) => {
      if (m.material_kind === "bonus") return "Platform bonus";
      if (m.course_id) return courses.get(m.course_id) ?? `Course #${m.course_id}`;
      if (m.module_id) {
        const mod = modules.get(m.module_id);
        return mod ? `${courses.get(mod.course_id) ?? "Course"} › ${mod.title}` : `Module #${m.module_id}`;
      }
      if (m.lesson_id) {
        const les = lessons.get(m.lesson_id);
        const mod = les ? modules.get(les.module_id) : undefined;
        return les ? `${mod ? `${mod.title} › ` : ""}${les.title}` : `Lesson #${m.lesson_id}`;
      }
      return "—";
    };
  }, [cat]);

  const visible = materials.filter((m) => {
    if (filter !== "all" && m.material_kind !== filter) return false;
    if (!term.trim()) return true;
    const q = term.toLowerCase();
    return (m.title ?? m.file_name).toLowerCase().includes(q) || labelFor(m).toLowerCase().includes(q);
  });

  function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    uploadMutation.mutate(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <AdminShell
      title="Materials"
      description="Central library for every support material. Upload once and choose whether it belongs to a course, a module, a lesson, or is a platform bonus."
      crumbs={[{ label: "Materials" }]}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4 text-primary" /> Add material
          </h2>

          <TargetPicker
            kind={kind}
            setKind={setKind}
            courseId={courseId}
            setCourseId={setCourseId}
            moduleId={moduleId}
            setModuleId={setModuleId}
            lessonId={lessonId}
            setLessonId={setLessonId}
            catalog={cat}
          />

          <div className="flex gap-1 rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`min-h-[36px] flex-1 rounded px-2 text-xs ${mode === "file" ? "bg-muted font-medium" : "text-foreground/60"}`}
            >
              File
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`min-h-[36px] flex-1 rounded px-2 text-xs ${mode === "link" ? "bg-muted font-medium" : "text-foreground/60"}`}
            >
              External link
            </button>
          </div>

          {mode === "file" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
              } ${scope ? "" : "opacity-60"}`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.currentTarget.files);
                  e.currentTarget.value = "";
                }}
              />
              <Upload className="mx-auto mb-2 h-5 w-5 text-foreground/40" />
              <p className="text-foreground/70">
                Drag &amp; drop files, or{" "}
                <button
                  type="button"
                  className="text-primary underline disabled:opacity-50"
                  disabled={!scope}
                  onClick={() => inputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-[11px] text-foreground/50">PDF, Office, images, audio, ZIP — up to 50 MB each.</p>
              {progress !== null ? (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <Label className="text-[11px]">Title</Label>
                <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Workbook" />
              </div>
              <div>
                <Label className="text-[11px]">URL</Label>
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
              </div>
              <Button
                type="button"
                className="min-h-[44px] w-full"
                disabled={!scope || !linkUrl.trim() || linkMutation.isPending}
                onClick={() => linkMutation.mutate()}
              >
                <Plus className="mr-1 h-4 w-4" /> Add link
              </Button>
            </div>
          )}

          {!scope ? (
            <p className="text-[11px] text-amber-600">Select the course / module / lesson before uploading.</p>
          ) : null}
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-primary" /> Library
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/60">{visible.length}</span>
            </h2>
            <div className="ml-auto flex items-center gap-1 rounded-md border px-2">
              <Search className="h-3.5 w-3.5 text-foreground/50" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search materials…"
                aria-label="Search materials"
                className="h-9 w-40 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {(["all", "bonus", "course", "module", "lesson"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`min-h-[32px] rounded-full border px-3 text-xs capitalize ${
                  filter === f ? "border-primary bg-primary/10 font-semibold" : "border-border text-foreground/60"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-xs text-foreground/50">Loading materials…</p>
          ) : visible.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-xs text-foreground/55">No materials found.</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((material) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  target={labelFor(material)}
                  catalog={cat}
                  onChanged={invalidate}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

function MaterialRow({
  material,
  target,
  catalog,
  onChanged,
}: {
  material: SupportMaterial;
  target: string;
  catalog: Catalog;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(material.title ?? material.file_name);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<MaterialKind>(material.material_kind);
  const [courseId, setCourseId] = useState(material.course_id ? String(material.course_id) : "");
  const [moduleId, setModuleId] = useState(material.module_id ? String(material.module_id) : "");
  const [lessonId, setLessonId] = useState(material.lesson_id ? String(material.lesson_id) : "");

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === (material.title ?? material.file_name)) return;
    try {
      await updateMaterial(material.id, { title: next });
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function open() {
    try {
      setBusy(true);
      const url = await getMaterialUrl(material);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${material.title ?? material.file_name}"? This cannot be undone.`)) return;
    try {
      setBusy(true);
      await deleteMaterial(material);
      toast.success("Material deleted");
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveTarget() {
    const scope = buildScope(kind, courseId, moduleId, lessonId);
    if (!scope) {
      toast.error("Choose the target first.");
      return;
    }
    try {
      setBusy(true);
      await reassignMaterial(material.id, scope);
      toast.success("Association updated");
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 rounded-md border bg-card/40 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {material.external_url ? (
          <Link2 className="h-4 w-4 shrink-0 text-foreground/50" />
        ) : material.material_kind === "bonus" ? (
          <Gift className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-foreground/50" />
        )}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="h-9 min-w-[140px] flex-1"
          aria-label="Material title"
        />
        <span className="text-[11px] text-foreground/50">
          {material.external_url ? "link" : `${material.file_type ?? "file"} ${formatBytes(material.file_size)}`}
        </span>
        <Button type="button" size="sm" variant="outline" className="min-h-[36px]" onClick={open} disabled={busy}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : material.external_url ? (
            <ExternalLink className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </Button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded p-2 text-destructive hover:bg-destructive/10"
          aria-label="Delete material"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground/60">
        <span className="rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">{material.material_kind}</span>
        <span className="truncate">{target}</span>
        <button type="button" className="underline" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Change association"}
        </button>
        {material.material_kind === "bonus" ? (
          <label className="ml-auto flex items-center gap-1.5">
            <Switch
              checked={material.is_public}
              onCheckedChange={async (checked) => {
                try {
                  await updateMaterial(material.id, { is_public: checked });
                  onChanged();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            />
            Released to members
          </label>
        ) : null}
        <label className="flex items-center gap-1.5">
          <Switch
            checked={material.is_downloadable}
            onCheckedChange={async (checked) => {
              try {
                await updateMaterial(material.id, { is_downloadable: checked });
                onChanged();
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
          Downloadable
        </label>
      </div>

      {editing ? (
        <div className="space-y-2 rounded-md border border-dashed p-2">
          <TargetPicker
            kind={kind}
            setKind={setKind}
            courseId={courseId}
            setCourseId={setCourseId}
            moduleId={moduleId}
            setModuleId={setModuleId}
            lessonId={lessonId}
            setLessonId={setLessonId}
            catalog={catalog}
          />
          <Button type="button" size="sm" className="min-h-[40px]" onClick={saveTarget} disabled={busy}>
            Save association
          </Button>
        </div>
      ) : null}
    </li>
  );
}