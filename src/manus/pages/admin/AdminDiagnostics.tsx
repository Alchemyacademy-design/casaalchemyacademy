import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/manus/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getCoursesTree, type AdminCatalog } from "@/manus/services/admin-content";

const PROJECT_REF = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? "—";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-b-0">
      <span className="text-xs uppercase tracking-[0.12em] text-foreground/55">{label}</span>
      <span className="text-sm font-mono text-right break-all">{value}</span>
    </div>
  );
}

export default function AdminDiagnostics() {
  const auth = useAuth();
  const [authMeStatus, setAuthMeStatus] = useState<{ ok: boolean; status?: number; error?: string } | null>(null);
  const [authMeChecking, setAuthMeChecking] = useState(false);

  const catalog = useQuery<AdminCatalog>({
    queryKey: ["admin", "diagnostics-catalog", auth.session?.user.id ?? null],
    queryFn: getCoursesTree,
    enabled: auth.authReady && auth.accessReady && auth.isAdmin && !!auth.session,
    retry: 1,
    refetchOnMount: "always",
  });

  const pingAuthMe = async () => {
    setAuthMeChecking(true);
    try {
      const { error } = await supabase.functions.invoke("auth-me", { method: "POST" });
      setAuthMeStatus({ ok: !error, error: error?.message });
    } catch (err) {
      setAuthMeStatus({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setAuthMeChecking(false);
    }
  };

  useEffect(() => {
    if (auth.session) void pingAuthMe();
  }, [auth.session?.access_token]);

  const report = {
    user_id: auth.session?.user.id ?? null,
    email: auth.session?.user.email ?? null,
    session_exists: !!auth.session,
    authReady: auth.authReady,
    accessReady: auth.accessReady,
    accessSource: auth.accessSource,
    roles: auth.roles,
    isAdmin: auth.isAdmin,
    project_ref: PROJECT_REF,
    auth_me: authMeStatus,
    counts: catalog.data?.counts ?? null,
    catalog_source: catalog.data?.source ?? null,
    error: auth.error ?? (catalog.error instanceof Error ? catalog.error.message : null),
  };

  return (
    <AdminShell title="Diagnostics" description="Admin authorization + content catalog health." crumbs={[{ label: "Diagnostics" }]}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-serif text-lg mb-3">Authorization</h3>
          <Row label="User ID" value={report.user_id ?? "—"} />
          <Row label="Email" value={report.email ?? "—"} />
          <Row label="Session" value={report.session_exists ? "yes" : "no"} />
          <Row label="authReady" value={String(report.authReady)} />
          <Row label="accessReady" value={String(report.accessReady)} />
          <Row label="accessSource" value={report.accessSource ?? "—"} />
          <Row label="Roles" value={report.roles.length ? report.roles.join(", ") : "—"} />
          <Row label="isAdmin" value={String(report.isAdmin)} />
          <Row label="Project Ref" value={PROJECT_REF} />
          <Row
            label="auth-me"
            value={
              authMeChecking ? "checking…" : authMeStatus
                ? authMeStatus.ok ? "ok" : `error: ${authMeStatus.error ?? "unknown"}`
                : "—"
            }
          />
          {report.error && <Row label="Last error" value={<span className="text-destructive">{report.error}</span>} />}
        </Card>

        <Card className="p-4">
          <h3 className="font-serif text-lg mb-3">Content catalog</h3>
          <Row label="Source" value={catalog.data?.source ?? (catalog.isLoading ? "loading…" : "—")} />
          <Row label="Courses" value={catalog.data?.counts.courses ?? "—"} />
          <Row label="Modules" value={catalog.data?.counts.modules ?? "—"} />
          <Row label="Lessons" value={catalog.data?.counts.lessons ?? "—"} />
          <Row label="Published courses" value={catalog.data?.counts.published_courses ?? "—"} />
          <Row label="Draft courses" value={catalog.data?.counts.draft_courses ?? "—"} />
          <Row label="Lessons missing video" value={catalog.data?.counts.missing_video_urls ?? "—"} />
          {catalog.error instanceof Error && (
            <Row label="Catalog error" value={<span className="text-destructive">{catalog.error.message}</span>} />
          )}
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void auth.refreshAccess()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh access
        </Button>
        <Button variant="outline" onClick={() => void pingAuthMe()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Re-test auth-me
        </Button>
        <Button variant="outline" onClick={() => void catalog.refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Reload courses
        </Button>
        <Button
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(JSON.stringify(report, null, 2))}
        >
          <Copy className="w-4 h-4 mr-1" /> Copy diagnostic report
        </Button>
      </div>
    </AdminShell>
  );
}
