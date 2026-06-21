import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogOut, Search, ArrowRight } from "lucide-react";
import { useAuth } from "@/manus/hooks/useAuth";

interface UserRow {
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

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { loading, isAdmin, logout } = useAuth();
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin", "users", "list"],
    enabled: isAdmin,
    queryFn: async () => {
      const [
        { data: profiles, error: profileErr },
        { data: roles },
        { data: memberships },
      ] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name,display_name,created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
        supabase
          .from("memberships")
          .select("user_id,status,plan_key,ends_at")
          .eq("status", "active")
          .order("ends_at", { ascending: false }),
      ]);
      if (profileErr) throw profileErr;
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
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.full_name, u.display_name, u.id].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [users, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4" />
          <p className="text-foreground/70">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    setLocation("/");
    return null;
  }

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card">
        <div className="container flex items-center justify-between py-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-foreground/70 mt-1">Users &amp; Access</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setLocation("/admin/courses")}>Manage Courses</Button>
            <Button variant="outline" onClick={() => setLocation("/admin/content-import")}>Import Manus</Button>
            <Button variant="outline" onClick={() => setLocation("/admin/analytics")}>Analytics</Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or UUID"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Membership</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/60">Loading users…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/60">No users found.</td></tr>
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
                      <Button size="sm" variant="ghost" onClick={() => setLocation(`/admin/users/${u.id}`)}>
                        Manage <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
