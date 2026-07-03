import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-lg",
};

/**
 * Resolve a stored `avatar_path` value into a browser URL.
 * Handles three shapes we've seen in the wild:
 *  - `null` / empty → returns null (caller renders fallback)
 *  - full `http(s)://…` URL (what `AvatarUpload` saves today) → returned as-is
 *  - bare storage key inside `public-assets` → wrapped via `getPublicUrl`
 */
export function resolveAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
  const { data } = supabase.storage.from("public-assets").getPublicUrl(trimmed);
  return data?.publicUrl ?? null;
}

export function initialsFrom(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "AA";
  return (
    n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "AA"
  );
}

export interface UserAvatarProps {
  name?: string | null;
  avatarPath?: string | null;
  size?: Size;
  className?: string;
}

export default function UserAvatar({ name, avatarPath, size = "md", className }: UserAvatarProps) {
  const url = resolveAvatarUrl(avatarPath);
  const label = name ?? "Member";
  return (
    <Avatar className={cn(SIZE_CLASS[size], "shrink-0", className)}>
      {url ? <AvatarImage src={url} alt={label} /> : null}
      <AvatarFallback className="bg-accent/20 font-medium text-primary">{initialsFrom(label)}</AvatarFallback>
    </Avatar>
  );
}