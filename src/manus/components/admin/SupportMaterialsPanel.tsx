import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Link2, Loader2, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createMaterialLink,
  deleteMaterial,
  formatBytes,
  getMaterialUrl,
  listMaterials,
  scopeKeyOf,
  updateMaterial,
  uploadMaterialFile,
  type MaterialScope,
  type SupportMaterial,
} from "@/manus/lib/support-materials";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function SupportMaterialsPanel({
  scope,
  compact = false,
}: {
  scope: MaterialScope;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const scopeKey = scopeKeyOf(scope);
  const queryKey = ["admin", "support-materials", scopeKey];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const { data: materials = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listMaterials(scope),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let order = materials.length;
      for (const file of files) {
        await uploadMaterialFile({ scope, file, sortOrder: order++, onProgress: setProgress });
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
    mutationFn: () =>
      createMaterialLink({ scope, url: linkUrl, title: linkTitle || linkUrl, sortOrder: materials.length }),
    onSuccess: () => {
      toast.success("Link added");
      setLinkTitle("");
      setLinkUrl("");
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-foreground/60" />
          <h3 className={compact ? "text-xs font-semibold" : "font-semibold"}>Support materials</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/60">{materials.length}</span>
        </div>
        <div className="flex gap-1 rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`min-h-[32px] rounded px-2 text-xs ${mode === "file" ? "bg-muted font-medium" : "text-foreground/60"}`}
          >
            File
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={`min-h-[32px] rounded px-2 text-xs ${mode === "link" ? "bg-muted font-medium" : "text-foreground/60"}`}
          >
            External link
          </button>
        </div>
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
          }`}
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
            Drag & drop files here, or{" "}
            <button type="button" className="underline text-primary" onClick={() => inputRef.current?.click()}>
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
        <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <div>
            <Label className="text-[11px]">Title</Label>
            <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Workbook" />
          </div>
          <div>
            <Label className="text-[11px]">URL</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              className="min-h-[40px] w-full"
              disabled={!linkUrl.trim() || linkMutation.isPending}
              onClick={() => linkMutation.mutate()}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-foreground/50">Loading materials…</p>
      ) : materials.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-foreground/55">
          No support materials yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {materials.map((material) => (
            <MaterialRow key={material.id} material={material} onChanged={invalidate} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MaterialRow({ material, onChanged }: { material: SupportMaterial; onChanged: () => void }) {
  const [title, setTitle] = useState(material.title ?? material.file_name);
  const [busy, setBusy] = useState(false);

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

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border bg-card/40 p-2">
      {material.external_url ? (
        <Link2 className="h-4 w-4 shrink-0 text-foreground/50" />
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
      <label className="flex items-center gap-1.5 text-[11px] text-foreground/60">
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
      <Button type="button" size="sm" variant="outline" className="min-h-[36px]" onClick={open} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </Button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded p-2 text-red-600 hover:bg-red-50 hover:text-red-700"
        aria-label="Delete material"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
