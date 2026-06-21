import { supabase } from "@/integrations/supabase/client";

// `admin_access_audit_log` is not yet present in the schema / generated types.
// Treat permission / missing-table errors as "audit not provisioned" instead of
// throwing or silently rendering an empty list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export type AdminAuditRow = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  reason: string | null;
  actor_user_id?: string | null;
  target_user_id?: string | null;
  created_at: string;
};

export type AuditResult =
  | { available: true; rows: AdminAuditRow[] }
  | { available: false; reason: "missing_table" | "permission" | "unknown"; message: string; rows: [] };

const MISSING_CODES = new Set(["42P01", "PGRST205", "PGRST202"]);
const PERMISSION_CODES = new Set(["42501"]);

function classify(code: string | undefined, message: string | undefined): AuditResult {
  if (code && MISSING_CODES.has(code)) {
    return { available: false, reason: "missing_table", message: message ?? "Audit log not provisioned yet.", rows: [] };
  }
  if (code && PERMISSION_CODES.has(code)) {
    return { available: false, reason: "permission", message: message ?? "Audit log not readable for this role.", rows: [] };
  }
  return { available: false, reason: "unknown", message: message ?? "Audit log unavailable.", rows: [] };
}

export async function fetchAuditSafe(opts: {
  targetUserId?: string;
  limit?: number;
  columns?: string;
}): Promise<AuditResult> {
  const limit = opts.limit ?? 50;
  const columns = opts.columns ?? "*";
  try {
    let q = db.from("admin_access_audit_log").select(columns).order("created_at", { ascending: false }).limit(limit);
    if (opts.targetUserId) q = q.eq("target_user_id", opts.targetUserId);
    const { data, error } = await q;
    if (error) return classify(error.code, error.message);
    return { available: true, rows: (data ?? []) as AdminAuditRow[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return classify(undefined, message);
  }
}
