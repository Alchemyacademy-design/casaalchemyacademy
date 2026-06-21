import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  console.warn(
    "[Alchemy] VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY ausentes. Configure-os para conectar ao Supabase existente."
  );
}

export const supabase = createClient(url ?? "http://localhost:54321", key ?? "public-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "alchemy-academy-auth" },
});

export const supabaseConfigured = Boolean(url && key);
