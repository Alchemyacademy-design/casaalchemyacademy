// Backwards-compatible wrapper. All authentication state lives in the
// single global AuthProvider mounted in src/App.tsx. This hook only reads
// from that context — it does NOT subscribe to Supabase auth or call
// auth-me directly. Doing so previously caused duplicate listeners and
// race conditions that redirected the admin before /functions/v1/auth-me
// resolved.
export type { AuthUser, ActiveEntitlement, AuthContextValue } from "@/manus/contexts/AuthContext";
import { useAuthContext } from "@/manus/contexts/AuthContext";

export function useAuth() {
  return useAuthContext();
}
