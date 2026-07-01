import { ReactNode, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminShell from "@/manus/components/admin/AdminShell";
import FileUploadField from "@/manus/components/admin/FileUploadField";
import QueryStateView from "@/manus/components/QueryStateView";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PublicTableName = keyof Database["public"]["Tables"];

export const ADMIN_TABLE_PAGE_SIZE = 20;

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "datetime"
  | "select"
  | "json"
  | "file";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** For `type: "select"`: coerce the string value to a number before writing. */
  numericValue?: boolean;
  defaultValue?: unknown;
  hideInTable?: boolean;
  hideInForm?: boolean;
  /** Render override for table cell */
  render?: (row: Record<string, unknown>) => ReactNode;
  /** For `type: "file"`: storage folder under the `public-assets` bucket. */
  uploadFolder?: string;
  /** For `type: "file"`: accept attribute (e.g. "image/*" or "application/pdf"). */
  accept?: string;
  /** For `type: "file"`: render an image preview in the form. Defaults to true for image accept. */
  preview?: boolean;
}

/**
 * archive   → update({ archived_at: now() }); requires schema column.
 * hard      → physical delete (use only when archived_at is not available
 *             and no soft-delete column exists).
 * disabled  → no destructive button rendered.
 *
 * Default is "disabled". See docs/PHASE_1_DELETE_POLICY.md.
 */
export type DeletionMode = "archive" | "hard" | "disabled";

export interface AdminTablePageProps<T extends PublicTableName = PublicTableName> {
  title: string;
  description?: string;
  table: T;
  primaryKey?: string;
  /** Columns/fields. Order matters: shown left→right in table. */
  fields: FieldDef[];
  /**
   * Extra columns to pull from PostgREST that are NOT declared in `fields`
   * (e.g. for relation selects). When provided, the page builds a minimal
   * SELECT from `primaryKey ∪ fields ∪ orderBy ∪ searchFields ∪ extraSelect`.
   *
   * `selectOverride` opts out of the minimal-select derivation entirely and
   * passes the supplied string to PostgREST verbatim. Use only when a
   * relation join makes column-by-column derivation impractical, and record
   * the reason in docs/PHASE_1_IMPLEMENTATION_REPORT.md.
   */
  extraSelect?: string[];
  selectOverride?: string;
  /** Default order. */
  orderBy?: { column: string; ascending?: boolean };
  /** Public query keys to invalidate after a mutation (so the live site refreshes). */
  publicInvalidateKeys?: unknown[][];
  /** Searchable text fields (server-side ilike). */
  searchFields?: string[];
  /**
   * Deletion policy for this table. Default: "disabled".
   * - "archive" requires an `archived_at` column on the table.
   */
  deletionMode?: DeletionMode;
  /**
   * Extra columns to merge into the archive update payload (in addition to
   * `archived_at`). Use to set table-specific flags like `status = 'archived'`
   * without assuming every archivable table has the same shape.
   */
  archivePatch?: Record<string, unknown>;
}

function emptyForFields(fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.name] = f.defaultValue;
    else if (f.type === "boolean") out[f.name] = false;
    else if (f.type === "number") out[f.name] = null;
    else out[f.name] = "";
  }
  return out;
}

function formatCell(v: unknown, type: FieldType): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "datetime") {
    try { return new Date(String(v)).toLocaleString(); } catch { return String(v); }
  }
  if (type === "boolean") return v ? "yes" : "no";
  if (type === "json") return JSON.stringify(v);
  return String(v);
}

function toDbValue(v: unknown, type: FieldType): unknown {
  if (v === "" && type !== "text" && type !== "textarea") return null;
  if (type === "number") {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") return Boolean(v);
  if (type === "datetime") {
    if (!v) return null;
    return new Date(String(v)).toISOString();
  }
  if (type === "json") {
    if (!v) return null;
    if (typeof v === "object") return v;
    try { return JSON.parse(String(v)); } catch { return null; }
  }
  return v;
}

function toFormValue(v: unknown, type: FieldType): unknown {
  if (v === null || v === undefined) return type === "boolean" ? false : "";
  if (type === "datetime") {
    try {
      const d = new Date(String(v));
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ""; }
  }
  if (type === "json") return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  return v;
}

/**
 * Escape characters that PostgREST treats as filter separators or wildcards.
 * Used only to build `ilike` patterns from user input — values still go through
 * the supabase-js builder so they are URL-encoded.
 */
export function escapePostgrestLike(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\*/g, "\\*");
}

/**
 * Build the minimal PostgREST select string from the declared shape.
 * Always includes the primary key, configured fields, the order column and
 * the searchable columns. Extra columns may be appended (e.g. relations).
 */
export function buildMinimalSelect(args: {
  primaryKey: string;
  fields: FieldDef[];
  orderBy?: { column: string };
  searchFields?: string[];
  extra?: string[];
}): string {
  const cols = new Set<string>();
  cols.add(args.primaryKey);
  for (const f of args.fields) cols.add(f.name);
  if (args.orderBy) cols.add(args.orderBy.column);
  for (const s of args.searchFields ?? []) cols.add(s);
  for (const c of args.extra ?? []) cols.add(c);
  return Array.from(cols).join(",");
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function describeError(
  e: unknown,
  op: "save" | "delete" | "archive" | "load",
  table: string,
): { title: string; description: string } {
  const err = e as {
    message?: string;
    code?: string;
    hint?: string;
    details?: string;
    status?: number;
  };
  const raw = err?.message ?? "Unknown error";
  const code = err?.code ?? "";
  const msg = raw.toLowerCase();
  const opLabel = op;
  if (
    code === "42501" ||
    code === "PGRST301" ||
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("permission denied") ||
    msg.includes("not allowed")
  ) {
    return {
      title: `Cannot ${opLabel} — permission denied`,
      description:
        `Your role is not allowed to ${opLabel} rows in "${table}". ` +
        `This usually means the admin RLS policy or table GRANT is missing. ` +
        `Sign out/in to refresh your admin role, then retry. Raw: ${raw}`,
    };
  }
  if (err?.status === 401 || code === "PGRST302" || msg.includes("jwt")) {
    return { title: "Session expired", description: "Please sign in again and retry." };
  }
  if (code === "23505" || msg.includes("duplicate key")) {
    return { title: "Duplicate value", description: err?.details ?? raw };
  }
  if (code === "23503" || msg.includes("foreign key")) {
    return { title: "Linked record missing", description: err?.details ?? raw };
  }
  if (code === "23502" || msg.includes("null value in column")) {
    return { title: "Missing required field", description: err?.details ?? raw };
  }
  if (code === "22P02" || msg.includes("invalid input syntax")) {
    return { title: "Invalid value", description: err?.details ?? raw };
  }
  return { title: `Failed to ${opLabel}`, description: err?.hint ? `${raw} — ${err.hint}` : raw };
}

// Loose alias for the dynamic PostgREST builder used inside this component.
// Each query is still scoped to a single typed `supabase.from(table)`.
type AnyFromBuilder = ReturnType<typeof supabase.from>;

export default function AdminTablePage<T extends PublicTableName>(props: AdminTablePageProps<T>) {
  const {
    title,
    description,
    table,
    primaryKey = "id",
    fields,
    extraSelect,
    selectOverride,
    orderBy,
    publicInvalidateKeys = [],
    searchFields = [],
    deletionMode = "disabled",
    archivePatch,
  } = props;

  const qc = useQueryClient();

  const selectStr = useMemo(
    () =>
      selectOverride ??
      buildMinimalSelect({ primaryKey, fields, orderBy, searchFields, extra: extraSelect }),
    [selectOverride, primaryKey, fields, orderBy, searchFields, extraSelect],
  );

  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [page, setPage] = useState(0);

  // Reset to first page whenever the search term changes.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const orderTuple = useMemo(
    () => [orderBy?.column ?? primaryKey, orderBy?.ascending ?? true] as const,
    [orderBy?.column, orderBy?.ascending, primaryKey],
  );

  const queryKey = useMemo(
    () => [
      "admin",
      table,
      { page, search: debouncedSearch, order: orderTuple, select: selectStr, deletionMode },
    ],
    [table, page, debouncedSearch, orderTuple, selectStr, deletionMode],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Typed supabase.from(table) preserves the row type but we apply many
      // dynamic operations below; cast once to a builder alias.
      let q: AnyFromBuilder = supabase
        .from(table)
        .select(selectStr, { count: "exact" }) as unknown as AnyFromBuilder;

      // Default list hides archived rows. Restore UI will surface them later.
      if (deletionMode === "archive") {
        q = (q as unknown as { is: (col: string, value: null) => AnyFromBuilder })
          .is("archived_at", null);
      }

      // Server-side search across declared text columns.
      const term = debouncedSearch.trim();
      if (term && searchFields.length > 0) {
        const escaped = escapePostgrestLike(term);
        const filter = searchFields.map((c) => `${c}.ilike.*${escaped}*`).join(",");
        q = (q as unknown as { or: (filter: string) => AnyFromBuilder }).or(filter);
      }

      // Deterministic ordering: primary order + primary key as tiebreaker.
      q = (q as unknown as {
        order: (col: string, opts?: { ascending?: boolean }) => AnyFromBuilder;
      }).order(orderTuple[0], { ascending: orderTuple[1] });
      if (orderTuple[0] !== primaryKey) {
        q = (q as unknown as {
          order: (col: string, opts?: { ascending?: boolean }) => AnyFromBuilder;
        }).order(primaryKey, { ascending: true });
      }

      const from = page * ADMIN_TABLE_PAGE_SIZE;
      const to = from + ADMIN_TABLE_PAGE_SIZE - 1;
      q = (q as unknown as {
        range: (from: number, to: number) => AnyFromBuilder;
      }).range(from, to);

      const result = (await q) as unknown as {
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
        count: number | null;
      };
      if (result.error) throw result.error;
      return { rows: result.data ?? [], count: result.count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_TABLE_PAGE_SIZE));
  const showingFrom = totalCount === 0 ? 0 : page * ADMIN_TABLE_PAGE_SIZE + 1;
  const showingTo = Math.min(totalCount, page * ADMIN_TABLE_PAGE_SIZE + rows.length);

  // Pagination guard: if a deletion empties the current page, fall back one.
  useEffect(() => {
    if (!isFetching && rows.length === 0 && page > 0 && totalCount > 0) {
      setPage((p) => Math.max(0, p - 1));
    }
  }, [isFetching, rows.length, page, totalCount]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", table] });
    for (const k of publicInvalidateKeys) qc.invalidateQueries({ queryKey: k });
  };

  const saveMutation = useMutation({
    mutationFn: async (record: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.hideInForm) continue;
        let v: unknown = toDbValue(record[f.name], f.type);
        if (f.type === "select" && f.numericValue && v !== null && v !== undefined && v !== "") {
          const n = Number(v);
          v = Number.isFinite(n) ? n : null;
        }
        payload[f.name] = v;
      }
      const id = record[primaryKey];
      const client = supabase.from(table) as unknown as {
        update: (p: Record<string, unknown>) => {
          eq: (col: string, value: unknown) => Promise<{ error: { message: string } | null }>;
        };
        insert: (p: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
      if (id) {
        const { error } = await client.update(payload).eq(primaryKey, id);
        if (error) throw error;
      } else {
        const { error } = await client.insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidateAll();
    },
    onError: (e: unknown) => {
      const { title: t, description: d } = describeError(e, "save", table);
      toast.error(t, { description: d });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: unknown) => {
      const client = supabase.from(table) as unknown as {
        update: (p: Record<string, unknown>) => {
          eq: (col: string, value: unknown) => Promise<{ error: { message: string } | null }>;
        };
      };
      const { error } = await client
        .update({
          archived_at: new Date().toISOString(),
          ...(archivePatch ?? {}),
        })
        .eq(primaryKey, id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Archived");
      invalidateAll();
    },
    onError: (e: unknown) => {
      const { title: t, description: d } = describeError(e, "archive", table);
      toast.error(t, { description: d });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (id: unknown) => {
      const client = supabase.from(table) as unknown as {
        delete: () => {
          eq: (col: string, value: unknown) => Promise<{ error: { message: string } | null }>;
        };
      };
      const { error } = await client.delete().eq(primaryKey, id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      invalidateAll();
    },
    onError: (e: unknown) => {
      const { title: t, description: d } = describeError(e, "delete", table);
      toast.error(t, { description: d });
    },
  });

  const tableFields = fields.filter((f) => !f.hideInTable);
  const formFields = fields.filter((f) => !f.hideInForm);

  const deletionLabel = deletionMode === "archive" ? "Archive" : "Delete";
  const deletionVerb = deletionMode === "archive" ? "archive" : "delete";
  const confirmDestructive = (row: Record<string, unknown>) => {
    if (deletionMode === "disabled") return;
    if (!confirm(`${deletionLabel} this ${table.replace(/_/g, " ").replace(/s$/, "")}?`)) return;
    if (deletionMode === "archive") archiveMutation.mutate(row[primaryKey]);
    else hardDeleteMutation.mutate(row[primaryKey]);
  };

  return (
    <AdminShell
      title={title}
      description={description}
      crumbs={[{ label: title }]}
      actions={
        <Button onClick={() => setEditing(emptyForFields(fields))}>
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      }
    >
      {searchFields.length > 0 && (
        <Card className="p-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${searchFields.join(", ")}`}
              className="pl-9"
              aria-label="Search"
            />
          </div>
        </Card>
      )}

      <QueryStateView
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => refetch()}
        errorTitle={`Failed to load ${table}`}
        empty={false}
      >
        <Card className="overflow-hidden" aria-busy={isFetching ? "true" : "false"}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  {tableFields.map((f) => (
                    <th key={f.name} className="px-4 py-3 font-medium whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="px-4 py-3 w-1" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !isFetching && (
                  <tr>
                    <td
                      colSpan={tableFields.length + 1}
                      className="px-4 py-8 text-center text-foreground/60"
                    >
                      {debouncedSearch ? "No records match your search." : "No records."}
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={String(row[primaryKey])} className="border-t border-border/40 hover:bg-muted/20">
                    {tableFields.map((f) => (
                      <td key={f.name} className="px-4 py-3 align-top max-w-[240px] truncate">
                        {f.render ? f.render(row) : formatCell(row[f.name], f.type)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const r: Record<string, unknown> = { ...row };
                          for (const f of fields) r[f.name] = toFormValue(row[f.name], f.type);
                          r[primaryKey] = row[primaryKey];
                          setEditing(r);
                        }}
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {deletionMode !== "disabled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => confirmDestructive(row)}
                          aria-label={deletionLabel}
                          title={`${deletionLabel} (${deletionVerb})`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 text-xs text-foreground/70">
          <div>
            {totalCount === 0
              ? "No results"
              : `Showing ${showingFrom}–${showingTo} of ${totalCount}`}
            {isFetching && (
              <span className="ml-2 inline-flex items-center gap-1 text-foreground/50">
                <RefreshCw className="w-3 h-3 animate-spin" /> updating…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1 || isFetching || totalCount === 0}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      </QueryStateView>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.[primaryKey] ? "Edit" : "New"} {title.toLowerCase().replace(/s$/, "")}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              {formFields.map((f) => {
                const value = editing[f.name];
                const set = (v: unknown) => setEditing({ ...editing, [f.name]: v });
                return (
                  <div key={f.name}>
                    <Label className="text-xs">{f.label}{f.required && " *"}</Label>
                    {f.type === "textarea" ? (
                      <Textarea value={(value as string) ?? ""} onChange={(e) => set(e.target.value)} rows={4} />
                    ) : f.type === "boolean" ? (
                      <div className="pt-2"><Switch checked={Boolean(value)} onCheckedChange={set} /></div>
                    ) : f.type === "select" ? (
                      <Select value={(value as string) ?? ""} onValueChange={set}>
                        <SelectTrigger><SelectValue placeholder={f.placeholder} /></SelectTrigger>
                        <SelectContent>
                          {f.options?.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : f.type === "datetime" ? (
                      <Input type="datetime-local" value={(value as string) ?? ""} onChange={(e) => set(e.target.value)} />
                    ) : f.type === "number" ? (
                      <Input type="number" value={value === null || value === undefined ? "" : String(value)} onChange={(e) => set(e.target.value)} />
                    ) : f.type === "json" ? (
                      <Textarea value={(value as string) ?? ""} onChange={(e) => set(e.target.value)} rows={6} className="font-mono text-xs" />
                    ) : f.type === "file" ? (
                      <FileUploadField
                        value={(value as string) ?? null}
                        onChange={(v) => set(v ?? "")}
                        folder={f.uploadFolder ?? table}
                        accept={f.accept}
                        preview={f.preview}
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <Input value={(value as string) ?? ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              onClick={() => editing && saveMutation.mutate(editing)}
              disabled={saveMutation.isPending}
            >
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
