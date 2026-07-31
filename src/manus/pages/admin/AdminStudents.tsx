import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Search, Trash2, Loader2 } from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteUserAccount, isDesignatedAdminEmail } from "@/manus/lib/admin-api";
import { useUrlFilters } from "@/manus/hooks/useUrlFilters";
import { useSelection } from "@/manus/hooks/useSelection";
import BulkActionBar from "@/manus/components/admin/BulkActionBar";

interface StudentRow {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  created_at: string;
  roles: string[];
  membership_status: string | null;
  membership_plan: string | null;
  membership_ends_at: string | null;
}

export function AdminStudentsInner({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { values, set, reset } = useUrlFilters({ q: "", segment: "all" });
  const { q: search, segment } = values;
  const [target, setTarget] = useState<StudentRow | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const closeDelete = () => { setTarget(null); setTypedEmail(""); };

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteUserAccount(target.id, typedEmail.trim());
      toast.success(`${target.email ?? target.id} deleted`);
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      closeDelete();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeleting(false);
    }
  }

  const { data: rows = [], isLoading } = useQuery<StudentRow[]>({
    queryKey: ["admin", "students"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }, { data: memberships }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,display_name,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
        supabase
          .from("memberships")
          .select("user_id,status,plan_key,ends_at")
          .eq("status", "active")
          .order("ends_at", { ascending: false }),
      ]);
      if (error) throw error;
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      const memMap = new Map<string, { status: string; plan_key: string; ends_at: string }>();
      (memberships ?? []).forEach((m) => {
        if (!memMap.has(m.user_id)) memMap.set(m.user_id, m);
      });
      return (profiles ?? []).map((p) => {
        const m = memMap.get(p.id);
        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          display_name: p.display_name,
          created_at: p.created_at,
          roles: roleMap.get(p.id) ?? [],
          membership_status: m?.status ?? null,
          membership_plan: m?.plan_key ?? null,
          membership_ends_at: m?.ends_at ?? null,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const needle = (search ?? "").trim().toLowerCase();
    return rows.filter((u) => {
      if (needle && ![u.email, u.full_name, u.display_name, u.id].some((v) => (v ?? "").toLowerCase().includes(needle))) return false;
      switch (segment) {
        case "admins": return u.roles.includes("admin");
        case "active": return u.membership_status === "active";
        case "expired": {
          if (!u.membership_ends_at) return !u.membership_status;
          return new Date(u.membership_ends_at).getTime() < Date.now();
        }
        case "no-plan": return !u.membership_status;
        default: return true;
      }
    });
  }, [rows, search, segment]);

  const selection = useSelection<string>(filtered.map((f) => f.id));
  const selectedRows = filtered.filter((f) => selection.isSelected(f.id));

  async function copyEmails() {
    const emails = selectedRows.map((r) => r.email).filter(Boolean).join(", ");
    if (!emails) return toast.error("No emails in selection");
    try {
      await navigator.clipboard.writeText(emails);
      toast.success(`${selectedRows.length} email(s) copied`);
    } catch {
      toast.error("Clipboard blocked");
    }
  }

  const segments: Array<{ key: string; label: string; badge?: number }> = [
    { key: "all", label: "All", badge: rows.length },
    { key: "active", label: "Active plans", badge: rows.filter((r) => r.membership_status === "active").length },
    { key: "expired", label: "Expired / lapsed", badge: rows.filter((r) => r.membership_ends_at && new Date(r.membership_ends_at).getTime() < Date.now()).length },
    { key: "no-plan", label: "No plan", badge: rows.filter((r) => !r.membership_status).length },
    { key: "admins", label: "Admins", badge: rows.filter((r) => r.roles.includes("admin")).length },
  ];

  const body = (
    <>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {segments.map((s) => (
            <button
              key={s.key}
              onClick={() => set({ segment: s.key })}
              className={`text-xs rounded-full border px-3 py-1 transition ${
                segment === s.key ? "bg-foreground text-background" : "bg-background hover:bg-muted"
              }`}
            >
              {s.label} {typeof s.badge === "number" && <span className="opacity-70">· {s.badge}</span>}
            </button>
          ))}
          <div className="flex-1" />
          {(segment !== "all" || search) && (
            <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-foreground/50" />
          <Input
            value={search}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search by name, email or ID"
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-3 w-8">
                  <Checkbox
                    checked={selection.allSelected && filtered.length > 0}
                    onCheckedChange={(v) => (v ? selection.selectAll() : selection.clear())}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/60">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/60">No students found.</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={selection.isSelected(u.id)}
                      onCheckedChange={() => selection.toggle(u.id)}
                      aria-label={`Select ${u.email ?? u.id}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.display_name || u.full_name || "—"}</div>
                    <div className="text-xs text-foreground/50">{u.id}</div>
                  </td>
                  <td className="px-4 py-3">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.roles.includes("admin") ? (
                      <span className="inline-flex items-center rounded-full bg-accent/15 text-accent px-2 py-0.5 text-xs">admin</span>
                    ) : (
                      <span className="text-foreground/60">student</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.membership_status ? (
                      <span>
                        {u.membership_plan} · {u.membership_status}
                        {u.membership_ends_at && (
                          <span className="text-foreground/50 text-xs"> · until {new Date(u.membership_ends_at).toLocaleDateString()}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/users/${u.id}`)}>
                        Manage <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        title={isDesignatedAdminEmail(u.email) ? "Designated admin cannot be deleted" : "Delete user"}
                        disabled={isDesignatedAdminEmail(u.email)}
                        onClick={() => { setTarget(u); setTypedEmail(""); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <Button size="sm" variant="secondary" onClick={copyEmails}>Copy emails</Button>
        <Button
          size="sm"
          onClick={() => {
            if (selectedRows.length === 1) navigate(`/admin/users/${selectedRows[0].id}`);
            else toast.info("Open one student at a time from Manage — bulk grant flow coming soon.");
          }}
        >
          Open in People Hub
        </Button>
      </BulkActionBar>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) closeDelete(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete user permanently?</DialogTitle>
            <DialogDescription>
              This removes the login and every access record (memberships, course access, roles,
              progress, community activity) for this person. It cannot be undone. Type the email to confirm:
              <br /><span className="font-mono text-xs">{target?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <Input value={typedEmail} onChange={(e) => setTypedEmail(e.target.value)} placeholder={target?.email ?? ""} />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDelete}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting || typedEmail.trim().toLowerCase() !== (target?.email ?? "").trim().toLowerCase()}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
  if (embedded) return body;
  return (
    <AdminShell
      title="Students"
      description="Browse profiles, roles and subscriptions. Manage individual access from this list."
      crumbs={[{ label: "Students" }]}
    >
      {body}
    </AdminShell>
  );
}

export default function AdminStudents() { return <AdminStudentsInner />; }
