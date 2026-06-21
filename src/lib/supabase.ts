// Re-export the single Supabase client managed by Lovable.
// Keeping a separate client here caused two competing auth storages.
export { supabase } from "@/integrations/supabase/client";

export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
