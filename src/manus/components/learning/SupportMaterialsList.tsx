import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Download, ExternalLink, Eye, FileText, Loader2, Paperclip } from "lucide-react";
import {
  formatBytes,
  getMaterialPreviewUrl,
  getMaterialUrl,
  listMaterials,
  previewKindOf,
  scopeKeyOf,
  type MaterialScope,
  type SupportMaterial,
} from "@/manus/lib/support-materials";

function InlinePreview({ material }: { material: SupportMaterial }) {
  const kind = previewKindOf(material);
  const { data: url, isLoading, error } = useQuery({
    queryKey: ["material-preview", material.id],
    queryFn: () => getMaterialPreviewUrl(material),
    staleTime: 8 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-foreground/60">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading preview…
      </div>
    );
  }
  if (error || !url) {
    return <p className="p-4 text-xs text-foreground/60">Preview unavailable — use download instead.</p>;
  }

  if (kind === "image") {
    return (
      <img
        src={url}
        alt={material.title ?? material.file_name}
        loading="lazy"
        className="max-h-[70vh] w-full rounded-b-lg object-contain"
      />
    );
  }
  if (kind === "audio") {
    return <audio controls src={url} className="w-full p-4" />;
  }
  return (
    <iframe
      src={url}
      title={material.title ?? material.file_name}
      className="h-[70vh] w-full rounded-b-lg border-0 bg-background"
    />
  );
}

function MaterialItem({ material }: { material: SupportMaterial }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const canPreview = previewKindOf(material) !== "none";

  async function openExternal() {
    try {
      setBusy(true);
      const url = await getMaterialUrl(material);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this material");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card/50 transition-colors hover:border-primary/50">
      <div className="flex min-h-[44px] items-center gap-3 p-3">
        {material.external_url ? (
          <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{material.title ?? material.file_name}</span>
          {material.description ? (
            <span className="block truncate text-xs text-foreground/60">{material.description}</span>
          ) : null}
        </span>
        <span className="hidden shrink-0 text-[11px] uppercase tracking-wide text-foreground/50 sm:inline">
          {material.external_url ? "link" : formatBytes(material.file_size) || "file"}
        </span>
        {canPreview ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{open ? "Hide" : "View here"}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={openExternal}
          disabled={busy}
          aria-label={material.external_url ? "Open link" : "Download material"}
          className="inline-flex min-h-[36px] shrink-0 items-center rounded-md border border-border/60 px-2.5 text-foreground/70 hover:bg-muted"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : material.external_url ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
      </div>
      {canPreview && open ? (
        <div className="border-t border-border/60 bg-background/60">
          <InlinePreview material={material} />
        </div>
      ) : null}
    </div>
  );
}

export default function SupportMaterialsList({
  scope,
  title = "Support materials",
  emptyHidden = true,
}: {
  scope: MaterialScope;
  title?: string;
  emptyHidden?: boolean;
}) {
  const scopeKey = scopeKeyOf(scope);
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["support-materials", scopeKey],
    queryFn: () => listMaterials(scope),
  });

  if (isLoading) return null;
  if (materials.length === 0 && emptyHidden) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="h-4 w-4 text-primary" /> {title}
      </h3>
      {materials.length === 0 ? (
        <p className="text-xs text-foreground/55">No materials for this section yet.</p>
      ) : (
        <div className="space-y-2">
          {materials.map((material) => (
            <MaterialItem key={material.id} material={material} />
          ))}
        </div>
      )}
    </section>
  );
}
