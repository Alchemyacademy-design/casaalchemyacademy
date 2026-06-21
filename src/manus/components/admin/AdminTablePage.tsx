import { ReactNode, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save, X, Search } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "datetime"
  | "select"
  | "json";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  hideInTable?: boolean;
  hideInForm?: boolean;
  /** Render override for table cell */
  render?: (row: Record<string, unknown>) => ReactNode;
}

export interface AdminTablePageProps {
  title: string;
  description?: string;
  table: string;
  primaryKey?: string;
  /** Columns/fields. Order matters: shown left→right in table. */
  fields: FieldDef[];
  /** Columns selected from supabase. Defaults to "*". */
  select?: string;
  /** Default order. */
  orderBy?: { column: string; ascending?: boolean };
  /** Public query keys to invalidate after a mutation (so the live site refreshes). */
  publicInvalidateKeys?: unknown[][];
  /** Searchable text fields (client-side). */
  searchFields?: string[];
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

export default function AdminTablePage(props: AdminTablePageProps) {
  const {
    title,
    description,
    table,
    primaryKey = "id",
    fields,
    select = "*",
    orderBy,
    publicInvalidateKeys = [],
    searchFields = [],
  } = props;

  const qc = useQueryClient();
  const queryKey = useMemo(() => ["admin", table], [table]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = (supabase as any).from(table).select(select);
      if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey });
    for (const k of publicInvalidateKeys) qc.invalidateQueries({ queryKey: k });
  };

  const describeError = (
    e: unknown,
    op: "save" | "delete",
  ): { title: string; description: string } => {
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
    const opLabel = op === "save" ? "save" : "delete";

    // Permission / RLS
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
    // Auth
    if (err?.status === 401 || code === "PGRST302" || msg.includes("jwt")) {
      return {
        title: "Session expired",
        description: "Please sign in again and retry.",
      };
    }
    // Unique / FK / not-null
    if (code === "23505" || msg.includes("duplicate key")) {
      return {
        title: "Duplicate value",
        description: `A row with the same unique field already exists. ${err?.details ?? raw}`,
      };
    }
    if (code === "23503" || msg.includes("foreign key")) {
      return {
        title: "Linked record missing",
        description: `A referenced record does not exist or is still in use. ${err?.details ?? raw}`,
      };
    }
    if (code === "23502" || msg.includes("null value in column")) {
      return {
        title: "Missing required field",
        description: err?.details ?? raw,
      };
    }
    if (code === "22P02" || msg.includes("invalid input syntax")) {
      return {
        title: "Invalid value",
        description: `One of the fields has an invalid format. ${err?.details ?? raw}`,
      };
    }
    return {
      title: `Failed to ${opLabel}`,
      description: err?.hint ? `${raw} — ${err.hint}` : raw,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (record: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.hideInForm) continue;
        payload[f.name] = toDbValue(record[f.name], f.type);
      }
      const id = record[primaryKey];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = supabase;
      if (id) {
        const { error } = await client.from(table).update(payload).eq(primaryKey, id);
        if (error) throw error;
      } else {
        const { error } = await client.from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidateAll();
    },
    onError: (e: unknown) => {
      const { title, description } = describeError(e, "save");
      toast.error(title, { description });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).delete().eq(primaryKey, id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      invalidateAll();
    },
    onError: (e: unknown) => {
      const { title, description } = describeError(e, "delete");
      toast.error(title, { description });
    },
  });

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || searchFields.length === 0) return rows;
    return rows.filter((r) =>
      searchFields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search, searchFields]);

  const tableFields = fields.filter((f) => !f.hideInTable);
  const formFields = fields.filter((f) => !f.hideInForm);

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
              placeholder="Search"
              className="pl-9"
            />
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 text-sm">
          <div className="font-medium text-destructive mb-1">Failed to load {table}</div>
          <pre className="text-xs whitespace-pre-wrap">{(error as Error).message}</pre>
        </Card>
      )}

      <Card className="overflow-hidden">
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
              {isLoading && (
                <tr><td colSpan={tableFields.length + 1} className="px-4 py-8 text-center text-foreground/60">Loading…</td></tr>
              )}
              {!isLoading && visibleRows.length === 0 && (
                <tr><td colSpan={tableFields.length + 1} className="px-4 py-8 text-center text-foreground/60">No records.</td></tr>
              )}
              {visibleRows.map((row) => (
                <tr key={String(row[primaryKey])} className="border-t border-border/40 hover:bg-muted/20">
                  {tableFields.map((f) => (
                    <td key={f.name} className="px-4 py-3 align-top max-w-[240px] truncate">
                      {f.render ? f.render(row) : formatCell(row[f.name], f.type)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => {
                      const r: Record<string, unknown> = { ...row };
                      for (const f of fields) r[f.name] = toFormValue(row[f.name], f.type);
                      r[primaryKey] = row[primaryKey];
                      setEditing(r);
                    }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete this ${table.replace(/_/g, " ").replace(/s$/, "")}?`)) {
                          deleteMutation.mutate(row[primaryKey]);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
