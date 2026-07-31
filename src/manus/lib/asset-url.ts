import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve an image/file reference stored in the database into a URL the browser
 * can load. Admins may save either a full URL (the upload helper returns one),
 * a site-relative path, or a bare `public-assets` storage key typed by hand.
 */
export function resolveAssetUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  const key = raw.replace(/^public-assets\//, "");
  const { data } = supabase.storage.from("public-assets").getPublicUrl(key);
  return data.publicUrl || null;
}
