// Re-export the Supabase client managed by Lovable as an untyped handle.
// Keeping a separately-typed client previously caused pages that share the
// dynamic tRPC facade to fail strict type checks.
import { supabase as typedClient } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const supabase: SupabaseClient = typedClient as unknown as SupabaseClient;

export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
