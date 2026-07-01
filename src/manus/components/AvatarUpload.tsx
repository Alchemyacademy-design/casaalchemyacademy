import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  currentUrl: string | null | undefined;
  displayName: string;
  onChange: (newUrl: string | null) => Promise<void> | void;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "AA"
  );
}

export default function AvatarUpload({ userId, currentUrl, displayName, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async (file: File) => {
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      return toast.error("Use PNG, JPG, WebP or GIF.");
    }
    if (file.size > MAX_BYTES) {
      return toast.error(`Image too large (${Math.round(file.size / 1024)} KB). Max 2 MB.`);
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const key = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("public-assets")
        .upload(key, file, { upsert: false, cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("public-assets").getPublicUrl(key);
      await onChange(data.publicUrl);
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div
        className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-lg font-semibold"
        style={{ backgroundColor: "var(--aa-olive-dark, #556B4B)" }}
        aria-hidden="true"
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{initials(displayName)}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border disabled:opacity-60"
          style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {currentUrl ? "Replace photo" : "Upload photo"}
        </button>
        {currentUrl && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-red-700 hover:underline"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        )}
        <p className="text-[11px]" style={{ color: "var(--aa-text-light)" }}>
          PNG, JPG or WebP. Max 2 MB. Shown in the community.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
