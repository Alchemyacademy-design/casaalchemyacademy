import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, ExternalLink, FileText, Video as VideoIcon, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { uploadPublicAsset } from "@/manus/lib/admin-content";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  folder: string;
  accept?: string;
  preview?: boolean;
  placeholder?: string;
  /** Soft max size in MB. Defaults: image 10, pdf 100, video 1024. */
  maxSizeMB?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function kindFromAccept(accept: string): "image" | "pdf" | "video" | "other" {
  if (accept.startsWith("image")) return "image";
  if (accept.includes("pdf")) return "pdf";
  if (accept.startsWith("video")) return "video";
  return "other";
}

function defaultMaxMB(kind: ReturnType<typeof kindFromAccept>): number {
  if (kind === "image") return 10;
  if (kind === "pdf") return 100;
  if (kind === "video") return 1024;
  return 100;
}

function mimeMatchesAccept(fileType: string, fileName: string, accept: string): boolean {
  if (!accept || accept === "*" || accept === "*/*") return true;
  const parts = accept.split(",").map((s) => s.trim().toLowerCase());
  const type = fileType.toLowerCase();
  const ext = "." + (fileName.split(".").pop() || "").toLowerCase();
  return parts.some((p) => {
    if (!p) return false;
    if (p.startsWith(".")) return p === ext;
    if (p.endsWith("/*")) return type.startsWith(p.slice(0, -1));
    return p === type;
  });
}

export default function FileUploadField({
  value,
  onChange,
  folder,
  accept = "image/*",
  preview,
  placeholder,
  maxSizeMB,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const kind = useMemo(() => kindFromAccept(accept), [accept]);
  const showPreview = preview ?? kind === "image";
  const maxMB = maxSizeMB ?? defaultMaxMB(kind);
  const maxBytes = maxMB * 1024 * 1024;

  const onFile = async (file: File) => {
    // Client-side validation with friendly messages
    if (!mimeMatchesAccept(file.type || "", file.name, accept)) {
      toast.error("Unsupported file type", {
        description: `Please upload a file matching: ${accept}. You selected ${file.type || file.name}.`,
      });
      return;
    }
    if (file.size > maxBytes) {
      toast.error("File too large", {
        description: `${file.name} is ${formatBytes(file.size)}. Maximum allowed is ${maxMB} MB. Compress the file or paste an external URL instead.`,
      });
      return;
    }

    setUploading(true);
    setProgress(`Uploading ${formatBytes(file.size)}…`);
    try {
      const url = await uploadPublicAsset(file, folder);
      onChange(url);
      toast.success("File uploaded", { description: file.name });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const lower = raw.toLowerCase();
      let description = raw;
      if (lower.includes("exceeded") || lower.includes("payload") || lower.includes("size")) {
        description = `The storage bucket rejected the file (likely bucket size limit). Try compressing, or increase the bucket file_size_limit in Supabase Storage settings.`;
      } else if (lower.includes("mime") || lower.includes("content-type")) {
        description = `File type not allowed by the storage bucket. Update the bucket's allowed MIME types in Supabase Storage settings.`;
      } else if (lower.includes("permission") || lower.includes("row-level") || lower.includes("rls")) {
        description = `You do not have permission to upload to this bucket. Check storage RLS policies.`;
      } else if (lower.includes("network") || lower.includes("failed to fetch")) {
        description = `Network error during upload. Check your connection and retry.`;
      }
      toast.error("Upload failed", { description });
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const clear = () => onChange(null);

  return (
    <div className="space-y-2">
      {value && showPreview && kind === "image" && (
        <div className="relative w-40 h-28 bg-muted rounded overflow-hidden border">
          <img
            src={value}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => ((e.currentTarget.style.opacity = "0.3"))}
          />
        </div>
      )}
      {value && kind === "pdf" && (
        <div className="space-y-1">
          <div className="w-full h-64 border rounded overflow-hidden bg-muted">
            <iframe
              src={`${value}#toolbar=0&navpanes=0`}
              title="PDF preview"
              className="w-full h-full"
            />
          </div>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline"
          >
            <ExternalLink className="w-3 h-3" /> Open PDF in new tab
          </a>
        </div>
      )}
      {value && kind === "video" && (
        <div className="w-full max-w-md">
          <video
            src={value}
            controls
            preload="metadata"
            className="w-full aspect-video rounded border bg-black"
          />
        </div>
      )}
      {value && kind === "other" && !showPreview && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary underline"
        >
          <ExternalLink className="w-3 h-3" /> View current file
        </a>
      )}

      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={placeholder ?? "https://… or upload"}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {kind === "image" ? (
            <ImageIcon className="w-4 h-4 mr-1" />
          ) : kind === "pdf" ? (
            <FileText className="w-4 h-4 mr-1" />
          ) : kind === "video" ? (
            <VideoIcon className="w-4 h-4 mr-1" />
          ) : (
            <Upload className="w-4 h-4 mr-1" />
          )}
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        {value && !uploading && (
          <Button type="button" variant="ghost" onClick={clear} title="Clear">
            <X className="w-4 h-4" />
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {progress ?? `Accepted: ${accept} · Max ${maxMB} MB`}
      </p>
    </div>
  );
}
