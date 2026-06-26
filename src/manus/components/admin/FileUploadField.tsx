import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { uploadPublicAsset } from "@/manus/lib/admin-content";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  folder: string;
  accept?: string;
  preview?: boolean;
  placeholder?: string;
}

export default function FileUploadField({
  value,
  onChange,
  folder,
  accept = "image/*",
  preview,
  placeholder,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const showPreview = preview ?? accept.startsWith("image");

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadPublicAsset(file, folder);
      onChange(url);
      toast.success("File uploaded");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value && showPreview && (
        <div className="w-32 h-20 bg-muted rounded overflow-hidden border">
          <img
            src={value}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => ((e.currentTarget.style.opacity = "0.3"))}
          />
        </div>
      )}
      {value && !showPreview && (
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
          <Upload className="w-4 h-4 mr-1" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
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
    </div>
  );
}
