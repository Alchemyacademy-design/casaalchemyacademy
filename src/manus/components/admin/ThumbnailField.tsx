import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { uploadCoverImage, isLegacyAssetPath } from "@/manus/lib/admin-content";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  folder: "courses" | "modules";
  label?: string;
}

export default function ThumbnailField({ value, onChange, folder, label = "Cover image" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const legacy = isLegacyAssetPath(value);

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadCoverImage(file, folder);
      onChange(url);
      toast.success("Image uploaded");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value && (
        <div className="flex gap-3 items-start">
          <div className="w-32 h-20 bg-muted rounded overflow-hidden border">
            <img src={value} alt="" className="w-full h-full object-cover" onError={(e) => ((e.currentTarget.style.opacity = "0.3"))} />
          </div>
          {legacy && (
            <div className="flex items-start gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 mt-0.5" />
              <span>Legacy cover — please re-upload.</span>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="https://… or upload below"
        />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
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
