import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  lessonId: number;
  /**
   * Current value of lessons.external_video_url. When it starts with
   * `lesson-videos://` we treat it as a private object key.
   */
  value: string | null;
  onUploaded: (newValue: string) => Promise<void> | void;
  onRemoved: () => Promise<void> | void;
}

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export default function LessonVideoUpload({ lessonId, value, onUploaded, onRemoved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isPrivate = (value ?? "").startsWith("lesson-videos://");
  const objectPath = isPrivate ? (value ?? "").slice("lesson-videos://".length) : null;

  const handleFile = async (file: File) => {
    if (!/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      return toast.error("Unsupported format. Use MP4, WebM or MOV.");
    }
    if (file.size > MAX_BYTES) {
      return toast.error(`File too large (${Math.round(file.size / 1024 / 1024)} MB). Max 500 MB.`);
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const key = `${lessonId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("lesson-videos")
        .upload(key, file, { upsert: false, contentType: file.type || "video/mp4" });
      if (error) {
        if (/bucket.*not found|does not exist|not exist/i.test(error.message)) {
          throw new Error(
            "Bucket `lesson-videos` not found. Apply the Phase 2 SQL migration first.",
          );
        }
        throw error;
      }
      await onUploaded(`lesson-videos://${key}`);
      toast.success("Video uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!objectPath) return;
    if (!confirm("Remove the uploaded video?")) return;
    try {
      await supabase.storage.from("lesson-videos").remove([objectPath]);
      await onRemoved();
      toast.success("Video removed");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-2 text-xs border rounded-md p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-foreground/60">Private upload (lesson-videos bucket)</span>
        {isPrivate ? (
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> uploaded
          </span>
        ) : (
          <span className="flex items-center gap-1 text-foreground/40">
            <AlertCircle className="w-3 h-3" /> none
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-3 h-3 mr-1" />
          {uploading ? "Uploading…" : isPrivate ? "Replace" : "Upload video"}
        </Button>
        {isPrivate && (
          <Button type="button" size="sm" variant="ghost" onClick={handleRemove} disabled={uploading}>
            <Trash2 className="w-3 h-3 mr-1 text-red-600" />
            Remove
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {isPrivate && (
        <p className="text-[10px] text-foreground/55 font-mono break-all">{objectPath}</p>
      )}
    </div>
  );
}
