import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

export default function AdminStudents() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

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
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) =>
      [u.email, u.full_name, u.display_name, u.id].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <AdminShell
      title="Alunos"
      description="Veja perfis, papéis e assinaturas. Gerencie permissões individuais a partir desta lista."
      crumbs={[{ label: "Alunos" }]}
    >
      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-foreground/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou ID"
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Aluno</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Assinatura</th>
                <th className="px-4 py-3 font-medium">Entrou em</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/60">Carregando…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/60">Nenhum aluno encontrado.</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.display_name || u.full_name || "—"}</div>
                    <div className="text-xs text-foreground/50">{u.id}</div>
                  </td>
                  <td className="px-4 py-3">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.roles.includes("admin") ? (
                      <span className="inline-flex items-center rounded-full bg-accent/15 text-accent px-2 py-0.5 text-xs">admin</span>
                    ) : (
                      <span className="text-foreground/60">aluno</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.membership_status ? (
                      <span>
                        {u.membership_plan} · {u.membership_status}
                        {u.membership_ends_at && (
                          <span className="text-foreground/50 text-xs"> · até {new Date(u.membership_ends_at).toLocaleDateString()}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/users/${u.id}`)}>
                      Gerenciar <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
