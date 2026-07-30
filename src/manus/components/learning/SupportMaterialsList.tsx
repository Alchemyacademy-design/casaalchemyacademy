import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, Loader2, Paperclip } from "lucide-react";
import {
  formatBytes,
  getMaterialUrl,
  listMaterials,
  scopeKeyOf,
  type MaterialScope,
  type SupportMaterial,
} from "@/manus/lib/support-materials";

function MaterialItem({ material }: { material: SupportMaterial }) {
  const [busy, setBusy] = useState(false);

  async function open() {
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
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="flex w-full min-h-[44px] items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3 text-left transition-colors hover:border-primary/50 hover:bg-card"
    >
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
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-foreground/50">
        {material.external_url ? "link" : formatBytes(material.file_size) || "file"}
      </span>
      {busy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground/50" />
      ) : (
        <Download className="h-4 w-4 shrink-0 text-foreground/50" />
      )}
    </button>
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
